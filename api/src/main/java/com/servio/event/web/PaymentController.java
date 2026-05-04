package com.servio.event.web;

import com.servio.event.dto.NetopiaIpnRequest;
import com.servio.event.dto.NetopiaIpnResponse;
import com.servio.event.dto.StartPaymentResponse;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.repository.OrderRepository;
import com.servio.event.service.NetopiaPaymentService;
import com.servio.event.service.PaymentService;
import com.servio.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final NetopiaPaymentService netopiaPaymentService;
    private final PaymentService paymentService;
    private final RegistrationService registrationService;
    private final OrderRepository orderRepository;

    /**
     * Start payment for a single order.
     */
    @PostMapping("/netopia/start/order")
    public ResponseEntity<StartPaymentWithReferenceResponse> startOrderPayment(@RequestBody OrderPaymentRequest request) {
        String reference = paymentService.createOrderPayment(request.orderId());
        String[] customerName = registrationService.getCustomerNameByOrderId(request.orderId());
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, request.amount(), customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Start payment for all orders of a guest (registration).
     */
    @PostMapping("/netopia/start/guest")
    public ResponseEntity<StartPaymentWithReferenceResponse> startGuestPayment(@RequestBody GuestPaymentRequest request) {
        log.info("Starting guest payment: registrationId={}, amount={}", request.registrationId(), request.amount());
        String reference = paymentService.createGuestPayment(request.registrationId());
        log.info("Created guest payment reference: {}", reference);
        String[] customerName = registrationService.getCustomerNameByRegistrationId(request.registrationId());
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, request.amount(), customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Start payment for all orders at an order point (total).
     */
    @PostMapping("/netopia/start/orderpoint")
    public ResponseEntity<StartPaymentWithReferenceResponse> startOrderPointPayment(@RequestBody OrderPointPaymentRequest request) {
        String reference = paymentService.createOrderPointPayment(request.orderPointId());
        String[] customerName = registrationService.getCustomerNameByOrderPointId(request.orderPointId());
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, request.amount(), customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Legacy endpoint - kept for backwards compatibility.
     */
    @PostMapping("/netopia/start")
    public ResponseEntity<StartPaymentWithReferenceResponse> startNetopiaPayment(@RequestBody LegacyPaymentRequest request) {
        UUID orderId = UUID.fromString(request.orderId());
        String reference = paymentService.createOrderPayment(orderId);
        String[] customerName = registrationService.getCustomerNameByOrderId(orderId);
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, request.amount(), customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Netopia IPN (Instant Payment Notification) callback.
     * Called by Netopia when payment status changes.
     */
    @PostMapping("/netopia/notify")
    public ResponseEntity<NetopiaIpnResponse> netopiaCallback(@RequestBody NetopiaIpnRequest request) {
        log.info("Received Netopia IPN callback: orderID={}, status={}, amount={}",
                request.getOrder() != null ? request.getOrder().getOrderID() : "null",
                request.getPayment() != null ? request.getPayment().getStatus() : "null",
                request.getOrder() != null ? request.getOrder().getAmount() : "null");

        try {
            if (request.getOrder() == null || request.getPayment() == null) {
                log.warn("Invalid IPN request: missing order or payment data");
                return ResponseEntity.ok(new NetopiaIpnResponse(1, "Invalid request"));
            }

            String orderReference = request.getOrder().getOrderID();
            Integer status = request.getPayment().getStatus();

            // Netopia payment statuses:
            // 3 = Confirmed/Paid
            // 5 = Confirmed pending (for some payment methods)
            // 15 = Pending (waiting for confirmation)
            // Other statuses indicate failure or cancellation

            if (status == 3 || status == 5) {
                log.info("Payment confirmed for order reference: {}", orderReference);
                paymentService.handlePaymentComplete(orderReference);
                return ResponseEntity.ok(new NetopiaIpnResponse(0, "Payment processed successfully"));
            } else if (status == 15) {
                log.info("Payment pending for order reference: {}", orderReference);
                return ResponseEntity.ok(new NetopiaIpnResponse(0, "Payment pending"));
            } else {
                log.warn("Payment not confirmed for order reference: {}, status: {}", orderReference, status);
                return ResponseEntity.ok(new NetopiaIpnResponse(0, "Payment status received: " + status));
            }
        } catch (Exception e) {
            log.error("Error processing Netopia IPN callback", e);
            return ResponseEntity.ok(new NetopiaIpnResponse(1, "Error processing callback: " + e.getMessage()));
        }
    }

    /**
     * Payment completion endpoint - called from redirect flow when user returns from Netopia.
     *
     * IMPORTANT: This endpoint does NOT mark payments as paid!
     * Payment confirmation is handled exclusively by the IPN callback (/netopia/notify).
     * This endpoint only acknowledges that the user has returned from the payment flow.
     */
    @PostMapping("/complete")
    public ResponseEntity<PaymentCompleteResponse> completePayment(@RequestBody CompletePaymentRequest request) {
        log.info("Payment redirect return for reference: {} - waiting for IPN confirmation", request.reference());
        // Do NOT call handlePaymentComplete here!
        // The IPN callback from Netopia (/netopia/notify) is the only source of truth
        // for whether a payment was actually completed.
        return ResponseEntity.ok(new PaymentCompleteResponse(
                true,
                "Payment processing - awaiting confirmation from payment provider",
                request.reference()
        ));
    }

    /**
     * Start payment for a single order (path-based endpoint).
     * Amount is calculated from unpaid items in the order.
     */
    @PostMapping("/orders/{orderId}/start")
    public ResponseEntity<StartPaymentWithReferenceResponse> startOrderPaymentByPath(
            @PathVariable UUID orderId,
            @RequestBody StartPaymentRequest request) {
        log.info("Starting order payment: orderId={}", orderId);

        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        double amount = calculateUnpaidAmount(order);
        if (request.tip() != null && request.tip() > 0) {
            amount += request.tip();
        }

        String reference = paymentService.createOrderPayment(orderId);
        String[] customerName = registrationService.getCustomerNameByOrderId(orderId);
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, amount, customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Start payment for all orders at an order point (path-based endpoint).
     * Amount is calculated from unpaid items at the order point.
     */
    @PostMapping("/order-points/{orderPointId}/start")
    public ResponseEntity<StartPaymentWithReferenceResponse> startOrderPointPaymentByPath(
            @PathVariable UUID orderPointId,
            @RequestBody StartPaymentRequest request) {
        log.info("Starting order point payment: orderPointId={}", orderPointId);

        List<OrderEntity> orders = orderRepository.findByOrderPointIdWithItems(orderPointId);
        double amount = orders.stream()
                .mapToDouble(this::calculateUnpaidAmount)
                .sum();

        if (request.tip() != null && request.tip() > 0) {
            amount += request.tip();
        }

        String reference = paymentService.createOrderPointPayment(orderPointId);
        String[] customerName = registrationService.getCustomerNameByOrderPointId(orderPointId);
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, amount, customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Start payment for all orders of a registration/guest (path-based endpoint).
     * Amount is calculated from unpaid items for the registration.
     */
    @PostMapping("/registrations/{registrationId}/start")
    public ResponseEntity<StartPaymentWithReferenceResponse> startRegistrationPaymentByPath(
            @PathVariable UUID registrationId,
            @RequestBody StartPaymentRequest request) {
        log.info("Starting registration payment: registrationId={}", registrationId);

        List<OrderEntity> orders = orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId);
        double amount = orders.stream()
                .mapToDouble(this::calculateUnpaidAmount)
                .sum();

        if (request.tip() != null && request.tip() > 0) {
            amount += request.tip();
        }

        String reference = paymentService.createGuestPayment(registrationId);
        String[] customerName = registrationService.getCustomerNameByRegistrationId(registrationId);
        StartPaymentResponse response = netopiaPaymentService.startPayment(reference, amount, customerName[0], customerName[1]);
        return ResponseEntity.ok(new StartPaymentWithReferenceResponse(response, reference));
    }

    /**
     * Calculates the total amount of unpaid, non-cancelled items in an order.
     */
    private double calculateUnpaidAmount(OrderEntity order) {
        return order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .filter(item -> !item.isPaid())
                .mapToDouble(item -> item.getPrice().doubleValue() * item.getQuantity())
                .sum();
    }

    // Request DTOs
    public record OrderPaymentRequest(UUID orderId, Double amount) {}
    public record GuestPaymentRequest(UUID registrationId, Double amount) {}
    public record OrderPointPaymentRequest(UUID orderPointId, Double amount) {}
    public record LegacyPaymentRequest(String orderId, Double amount) {}
    public record StartPaymentRequest(String returnUrl, Double tip) {}
    public record CompletePaymentRequest(String reference) {}
    public record PaymentCompleteResponse(boolean success, String message, String reference) {}

    // Response DTO that includes the payment reference
    public record StartPaymentWithReferenceResponse(
            Integer status,
            String message,
            StartPaymentResponse.PaymentData payment,
            String reference
    ) {
        public StartPaymentWithReferenceResponse(StartPaymentResponse response, String reference) {
            this(response.status(), response.message(), response.payment(), reference);
        }
    }
}
