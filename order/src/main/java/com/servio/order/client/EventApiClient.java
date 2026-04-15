package com.servio.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.util.UUID;

@FeignClient(name = "eventApiClient", url = "${services.event-api.url}")
public interface EventApiClient {

    @PostMapping("/api/internal/events/{eventId}/increment-order-no")
    Integer incrementAndGetOrderNo(@PathVariable("eventId") UUID eventId);

    @GetMapping("/api/internal/registrations/{registrationId}/event-id")
    UUID getEventIdByRegistrationId(@PathVariable("registrationId") UUID registrationId);

    @GetMapping("/api/internal/registrations/{registrationId}/nickname")
    String getNicknameByRegistrationId(@PathVariable("registrationId") UUID registrationId);

    /**
     * Handles payment completion for a single order.
     * @return Number of items marked as paid
     */
    @PostMapping("/api/internal/orders/{orderId}/payment-complete")
    Integer handleOrderPaymentComplete(@PathVariable("orderId") UUID orderId);

    /**
     * Handles payment completion for all orders of a registration (guest).
     * @return Number of items marked as paid
     */
    @PostMapping("/api/internal/registrations/{registrationId}/payment-complete")
    Integer handleGuestPaymentComplete(@PathVariable("registrationId") UUID registrationId);

    /**
     * Handles payment completion for all orders at an order point.
     * @return Number of items marked as paid
     */
    @PostMapping("/api/internal/order-points/{orderPointId}/payment-complete")
    Integer handleOrderPointPaymentComplete(@PathVariable("orderPointId") UUID orderPointId);

    /**
     * Gets unpaid amount for an order.
     */
    @GetMapping("/api/internal/orders/{orderId}/unpaid-amount")
    BigDecimal getOrderUnpaidAmount(@PathVariable("orderId") UUID orderId);

    /**
     * Gets unpaid amount for a registration.
     */
    @GetMapping("/api/internal/registrations/{registrationId}/unpaid-amount")
    BigDecimal getRegistrationUnpaidAmount(@PathVariable("registrationId") UUID registrationId);

    /**
     * Gets unpaid amount for an order point.
     */
    @GetMapping("/api/internal/order-points/{orderPointId}/unpaid-amount")
    BigDecimal getOrderPointUnpaidAmount(@PathVariable("orderPointId") UUID orderPointId);

    /**
     * Saves tip for a single order.
     */
    @PostMapping("/api/internal/orders/{orderId}/tip")
    void saveTipForOrder(@PathVariable("orderId") UUID orderId, @RequestParam("tip") BigDecimal tip);

    /**
     * Saves tip for all orders of a registration (distributed proportionally).
     */
    @PostMapping("/api/internal/registrations/{registrationId}/tip")
    void saveTipForRegistration(@PathVariable("registrationId") UUID registrationId, @RequestParam("tip") BigDecimal tip);

    /**
     * Saves tip for all orders at an order point (distributed proportionally).
     */
    @PostMapping("/api/internal/order-points/{orderPointId}/tip")
    void saveTipForOrderPoint(@PathVariable("orderPointId") UUID orderPointId, @RequestParam("tip") BigDecimal tip);
}
