package com.servio.order.web;

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
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Starting payment for order: {}", orderId);
        String paymentRef = paymentService.createOrderPayment(orderId);
        BigDecimal amount = paymentService.calculateOrderUnpaidAmount(orderId);
        String returnUrl = body != null ? body.get("returnUrl") : null;
        var response = netopiaPaymentService.startPayment(paymentRef, amount.doubleValue(), returnUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * Start payment for all orders of a registration (guest).
     */
    @PostMapping("/registrations/{registrationId}/start")
    public ResponseEntity<StartPaymentResponse> startGuestPayment(
            @PathVariable UUID registrationId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Starting guest payment for registration: {}", registrationId);
        String paymentRef = paymentService.createGuestPayment(registrationId);
        BigDecimal amount = paymentService.calculateRegistrationUnpaidAmount(registrationId);
        String returnUrl = body != null ? body.get("returnUrl") : null;
        var response = netopiaPaymentService.startPayment(paymentRef, amount.doubleValue(), returnUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * Start payment for all orders at an order point.
     */
    @PostMapping("/order-points/{orderPointId}/start")
    public ResponseEntity<StartPaymentResponse> startOrderPointPayment(
            @PathVariable UUID orderPointId,
            @RequestBody(required = false) Map<String, String> body) {
        log.info("Starting order point payment: {}", orderPointId);
        String paymentRef = paymentService.createOrderPointPayment(orderPointId);
        BigDecimal amount = paymentService.calculateOrderPointUnpaidAmount(orderPointId);
        String returnUrl = body != null ? body.get("returnUrl") : null;
        var response = netopiaPaymentService.startPayment(paymentRef, amount.doubleValue(), returnUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * Netopia payment notification callback (IPN).
     */
    @PostMapping("/netopia/notify")
    public ResponseEntity<Map<String, Object>> netopiaNotify(@RequestBody Map<String, Object> payload) {
        log.info("Received Netopia payment notification: {}", payload);

        String orderID = (String) payload.get("orderID");
        Map<String, Object> payment = (Map<String, Object>) payload.get("payment");
        Integer status = payment != null ? (Integer) payment.get("status") : null;

        if (status != null && status == 3) { // Status 3 = Confirmed
            log.info("Payment confirmed for orderID: {}", orderID);
            int itemsMarked = paymentService.handlePaymentComplete(orderID);
            log.info("Marked {} items as paid", itemsMarked);
        } else {
            log.info("Payment status {} for orderID: {}", status, orderID);
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
