package com.servio.event.web;

import com.servio.event.service.EventService;
import com.servio.event.service.OrderService;
import com.servio.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Internal API endpoints for inter-service communication.
 * These endpoints are used by the Order microservice.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final EventService eventService;
    private final RegistrationService registrationService;
    private final OrderService orderService;

    /**
     * Atomically increments and returns the next order number for an event.
     */
    @PostMapping("/events/{eventId}/increment-order-no")
    public ResponseEntity<Integer> incrementAndGetOrderNo(@PathVariable UUID eventId) {
        log.debug("Incrementing order number for event: {}", eventId);
        Integer orderNo = eventService.incrementAndGetLastOrderNo(eventId);
        return ResponseEntity.ok(orderNo);
    }

    /**
     * Gets the event ID for a registration.
     */
    @GetMapping("/registrations/{registrationId}/event-id")
    public ResponseEntity<UUID> getEventIdByRegistrationId(@PathVariable UUID registrationId) {
        log.debug("Getting event ID for registration: {}", registrationId);
        UUID eventId = registrationService.getEventIdByRegistrationId(registrationId);
        return ResponseEntity.ok(eventId);
    }

    /**
     * Gets the nickname for a registration.
     */
    @GetMapping("/registrations/{registrationId}/nickname")
    public ResponseEntity<String> getNicknameByRegistrationId(@PathVariable UUID registrationId) {
        log.debug("Getting nickname for registration: {}", registrationId);
        String nickname = registrationService.getNicknameByRegistrationId(registrationId);
        return ResponseEntity.ok(nickname);
    }

    /**
     * Handles payment completion for a single order.
     * Called by the Order Service when Netopia IPN confirms payment.
     */
    @PostMapping("/orders/{orderId}/payment-complete")
    public ResponseEntity<Integer> handleOrderPaymentComplete(@PathVariable UUID orderId) {
        log.info("Handling payment completion for order: {}", orderId);
        int itemsMarked = orderService.handlePaymentComplete(orderId, "ONLINE", "Netopia");
        return ResponseEntity.ok(itemsMarked);
    }

    /**
     * Handles payment completion for all orders of a registration (guest).
     */
    @PostMapping("/registrations/{registrationId}/payment-complete")
    public ResponseEntity<Integer> handleGuestPaymentComplete(@PathVariable UUID registrationId) {
        log.info("Handling guest payment completion for registration: {}", registrationId);
        int itemsMarked = orderService.handleGuestPaymentComplete(registrationId, "ONLINE", "Netopia");
        return ResponseEntity.ok(itemsMarked);
    }

    /**
     * Handles payment completion for all orders at an order point.
     */
    @PostMapping("/order-points/{orderPointId}/payment-complete")
    public ResponseEntity<Integer> handleOrderPointPaymentComplete(@PathVariable UUID orderPointId) {
        log.info("Handling order point payment completion for: {}", orderPointId);
        int itemsMarked = orderService.handleOrderPointPaymentComplete(orderPointId, "ONLINE", "Netopia");
        return ResponseEntity.ok(itemsMarked);
    }

    /**
     * Gets unpaid amount for an order.
     */
    @GetMapping("/orders/{orderId}/unpaid-amount")
    public ResponseEntity<BigDecimal> getOrderUnpaidAmount(@PathVariable UUID orderId) {
        BigDecimal amount = orderService.calculateOrderUnpaidAmount(orderId);
        return ResponseEntity.ok(amount);
    }

    /**
     * Gets unpaid amount for a registration.
     */
    @GetMapping("/registrations/{registrationId}/unpaid-amount")
    public ResponseEntity<BigDecimal> getRegistrationUnpaidAmount(@PathVariable UUID registrationId) {
        BigDecimal amount = orderService.calculateRegistrationUnpaidAmount(registrationId);
        return ResponseEntity.ok(amount);
    }

    /**
     * Gets unpaid amount for an order point.
     */
    @GetMapping("/order-points/{orderPointId}/unpaid-amount")
    public ResponseEntity<BigDecimal> getOrderPointUnpaidAmount(@PathVariable UUID orderPointId) {
        BigDecimal amount = orderService.calculateOrderPointUnpaidAmount(orderPointId);
        return ResponseEntity.ok(amount);
    }

    /**
     * Saves tip for a single order.
     */
    @PostMapping("/orders/{orderId}/tip")
    public ResponseEntity<Void> saveTipForOrder(
            @PathVariable UUID orderId,
            @RequestParam BigDecimal tip) {
        log.info("Saving tip {} for order: {}", tip, orderId);
        orderService.saveTip(orderId, tip);
        return ResponseEntity.ok().build();
    }

    /**
     * Saves tip for all orders of a registration (distributed proportionally).
     */
    @PostMapping("/registrations/{registrationId}/tip")
    public ResponseEntity<Void> saveTipForRegistration(
            @PathVariable UUID registrationId,
            @RequestParam BigDecimal tip) {
        log.info("Saving tip {} for registration: {}", tip, registrationId);
        orderService.saveTipForRegistration(registrationId, tip);
        return ResponseEntity.ok().build();
    }

    /**
     * Saves tip for all orders at an order point (distributed proportionally).
     */
    @PostMapping("/order-points/{orderPointId}/tip")
    public ResponseEntity<Void> saveTipForOrderPoint(
            @PathVariable UUID orderPointId,
            @RequestParam BigDecimal tip) {
        log.info("Saving tip {} for order point: {}", tip, orderPointId);
        orderService.saveTipForOrderPoint(orderPointId, tip);
        return ResponseEntity.ok().build();
    }
}
