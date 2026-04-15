package com.servio.order.web;

import com.servio.order.dto.PaymentStartRequest;
import com.servio.order.dto.StartPaymentResponse;
import com.servio.order.service.NetopiaPaymentService;
import com.servio.order.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final NetopiaPaymentService netopiaPaymentService;

    /**
     * Start payment for a single order.
     */
    @PostMapping("/orders/{orderId}/start")
    public ResponseEntity<StartPaymentResponse> startOrderPayment(
            @PathVariable UUID orderId,
            @RequestBody(required = false) PaymentStartRequest request) {
        log.info("=== STARTING PAYMENT ===");
        log.info("Order ID: {}", orderId);

        BigDecimal tip = request != null && request.getTip() != null ? request.getTip() : BigDecimal.ZERO;
        log.info("Tip: {}", tip);

        // Save tip to the order if provided
        if (tip.compareTo(BigDecimal.ZERO) > 0) {
            paymentService.saveTipForOrder(orderId, tip);
        }

        String paymentRef = paymentService.createOrderPayment(orderId);
        log.info("Payment reference sent to Netopia: {}", paymentRef);
        BigDecimal amount = paymentService.calculateOrderUnpaidAmount(orderId);
        // Add tip to the payment amount
        BigDecimal totalAmount = amount.add(tip);
        log.info("Order amount: {}, Tip: {}, Total: {}", amount, tip, totalAmount);
        String returnUrl = request != null ? request.getReturnUrl() : null;
        log.info("Return URL: {}", returnUrl);
        var response = netopiaPaymentService.startPayment(paymentRef, totalAmount.doubleValue(), returnUrl);
        log.info("Netopia response: {}", response);
        return ResponseEntity.ok(response);
    }

    /**
     * Start payment for all orders of a registration (guest).
     */
    @PostMapping("/registrations/{registrationId}/start")
    public ResponseEntity<StartPaymentResponse> startGuestPayment(
            @PathVariable UUID registrationId,
            @RequestBody(required = false) PaymentStartRequest request) {
        log.info("Starting guest payment for registration: {}", registrationId);

        BigDecimal tip = request != null && request.getTip() != null ? request.getTip() : BigDecimal.ZERO;
        log.info("Tip: {}", tip);

        // Save tip to the registration's orders if provided
        if (tip.compareTo(BigDecimal.ZERO) > 0) {
            paymentService.saveTipForRegistration(registrationId, tip);
        }

        String paymentRef = paymentService.createGuestPayment(registrationId);
        BigDecimal amount = paymentService.calculateRegistrationUnpaidAmount(registrationId);
        BigDecimal totalAmount = amount.add(tip);
        log.info("Order amount: {}, Tip: {}, Total: {}", amount, tip, totalAmount);
        String returnUrl = request != null ? request.getReturnUrl() : null;
        var response = netopiaPaymentService.startPayment(paymentRef, totalAmount.doubleValue(), returnUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * Start payment for all orders at an order point.
     */
    @PostMapping("/order-points/{orderPointId}/start")
    public ResponseEntity<StartPaymentResponse> startOrderPointPayment(
            @PathVariable UUID orderPointId,
            @RequestBody(required = false) PaymentStartRequest request) {
        log.info("Starting order point payment: {}", orderPointId);

        BigDecimal tip = request != null && request.getTip() != null ? request.getTip() : BigDecimal.ZERO;
        log.info("Tip: {}", tip);

        // Save tip to the order point's orders if provided
        if (tip.compareTo(BigDecimal.ZERO) > 0) {
            paymentService.saveTipForOrderPoint(orderPointId, tip);
        }

        String paymentRef = paymentService.createOrderPointPayment(orderPointId);
        BigDecimal amount = paymentService.calculateOrderPointUnpaidAmount(orderPointId);
        BigDecimal totalAmount = amount.add(tip);
        log.info("Order amount: {}, Tip: {}, Total: {}", amount, tip, totalAmount);
        String returnUrl = request != null ? request.getReturnUrl() : null;
        var response = netopiaPaymentService.startPayment(paymentRef, totalAmount.doubleValue(), returnUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * Netopia payment notification callback (IPN).
     */
    @PostMapping("/netopia/notify")
    public ResponseEntity<Map<String, Object>> netopiaNotify(@RequestBody Map<String, Object> payload) {
        log.info("=== NETOPIA IPN RECEIVED ===");
        log.info("Full payload: {}", payload);

        // Extract orderID from nested structure: {order: {orderID: "..."}, payment: {...}}
        @SuppressWarnings("unchecked")
        Map<String, Object> order = (Map<String, Object>) payload.get("order");
        log.info("Order object: {}", order);

        String orderID = order != null ? (String) order.get("orderID") : null;
        log.info("Extracted orderID: {}", orderID);

        @SuppressWarnings("unchecked")
        Map<String, Object> payment = (Map<String, Object>) payload.get("payment");
        log.info("Payment object: {}", payment);

        Integer status = payment != null ? (Integer) payment.get("status") : null;
        log.info("Payment status: {}", status);

        if (status != null && status == 3) { // Status 3 = Confirmed
            log.info("Payment CONFIRMED for orderID: {}", orderID);
            if (orderID != null) {
                int itemsMarked = paymentService.handlePaymentComplete(orderID);
                log.info("Marked {} items as paid for orderID: {}", itemsMarked, orderID);
            } else {
                log.warn("Payment confirmed but orderID is null! Full payload: {}", payload);
            }
        } else {
            log.info("Payment NOT confirmed. Status={} for orderID: {}", status, orderID);
        }

        // Return success response to Netopia
        return ResponseEntity.ok(Map.of(
                "errorCode", 0,
                "errorMessage", "Success"
        ));
    }

    /**
     * Get unpaid amount for an order.
     */
    @GetMapping("/orders/{orderId}/unpaid")
    public ResponseEntity<Map<String, BigDecimal>> getOrderUnpaidAmount(@PathVariable UUID orderId) {
        BigDecimal amount = paymentService.calculateOrderUnpaidAmount(orderId);
        return ResponseEntity.ok(Map.of("amount", amount));
    }

    /**
     * Get unpaid amount for a registration.
     */
    @GetMapping("/registrations/{registrationId}/unpaid")
    public ResponseEntity<Map<String, BigDecimal>> getRegistrationUnpaidAmount(@PathVariable UUID registrationId) {
        BigDecimal amount = paymentService.calculateRegistrationUnpaidAmount(registrationId);
        return ResponseEntity.ok(Map.of("amount", amount));
    }

    /**
     * Get unpaid amount for an order point.
     */
    @GetMapping("/order-points/{orderPointId}/unpaid")
    public ResponseEntity<Map<String, BigDecimal>> getOrderPointUnpaidAmount(@PathVariable UUID orderPointId) {
        BigDecimal amount = paymentService.calculateOrderPointUnpaidAmount(orderPointId);
        return ResponseEntity.ok(Map.of("amount", amount));
    }
}
