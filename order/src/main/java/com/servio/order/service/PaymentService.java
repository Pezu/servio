package com.servio.order.service;

import com.servio.order.client.EventApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final EventApiClient eventApiClient;

    // Payment reference prefixes
    private static final String PREFIX_ORDER = "ORDER-";
    private static final String PREFIX_GUEST = "GUEST-";
    private static final String PREFIX_ORDERPOINT = "ORDERPOINT-";
    private static final int UUID_LENGTH = 36;

    /**
     * Creates a payment reference for a single order.
     * Format: ORDER-{orderId}-{timestamp}
     */
    public String createOrderPayment(UUID orderId) {
        String reference = PREFIX_ORDER + orderId.toString() + "-" + generateUniqueSuffix();
        log.info("Created order payment reference: {}", reference);
        return reference;
    }

    /**
     * Creates a payment reference for all orders of a guest (registration).
     * Format: GUEST-{registrationId}-{timestamp}
     */
    public String createGuestPayment(UUID registrationId) {
        String reference = PREFIX_GUEST + registrationId.toString() + "-" + generateUniqueSuffix();
        log.info("Created guest payment reference: {} for registrationId: {}", reference, registrationId);
        return reference;
    }

    /**
     * Creates a payment reference for all orders at an order point (total).
     * Format: ORDERPOINT-{orderPointId}-{timestamp}
     */
    public String createOrderPointPayment(UUID orderPointId) {
        String reference = PREFIX_ORDERPOINT + orderPointId.toString() + "-" + generateUniqueSuffix();
        log.info("Created order point payment reference: {}", reference);
        return reference;
    }

    private String generateUniqueSuffix() {
        return Long.toHexString(System.currentTimeMillis());
    }

    /**
     * Handles payment completion based on the reference type.
     * Delegates to Event API which handles marking items as paid and publishing SQS events.
     * Returns the number of items marked as paid.
     */
    public int handlePaymentComplete(String paymentReference) {
        log.info("Processing payment completion for reference: {}", paymentReference);

        try {
            if (paymentReference.startsWith(PREFIX_ORDER)) {
                String orderIdStr = extractUuid(paymentReference, PREFIX_ORDER.length());
                log.info("Processing ORDER payment, orderId: {}", orderIdStr);
                UUID orderId = UUID.fromString(orderIdStr);
                Integer result = eventApiClient.handleOrderPaymentComplete(orderId);
                log.info("Event API returned {} items marked as paid for order {}", result, orderId);
                return result != null ? result : 0;

            } else if (paymentReference.startsWith(PREFIX_GUEST)) {
                String registrationIdStr = extractUuid(paymentReference, PREFIX_GUEST.length());
                log.info("Processing GUEST payment, registrationId: {}", registrationIdStr);
                UUID registrationId = UUID.fromString(registrationIdStr);
                Integer result = eventApiClient.handleGuestPaymentComplete(registrationId);
                log.info("Event API returned {} items marked as paid for registration {}", result, registrationId);
                return result != null ? result : 0;

            } else if (paymentReference.startsWith(PREFIX_ORDERPOINT)) {
                String orderPointIdStr = extractUuid(paymentReference, PREFIX_ORDERPOINT.length());
                log.info("Processing ORDERPOINT payment, orderPointId: {}", orderPointIdStr);
                UUID orderPointId = UUID.fromString(orderPointIdStr);
                Integer result = eventApiClient.handleOrderPointPaymentComplete(orderPointId);
                log.info("Event API returned {} items marked as paid for order point {}", result, orderPointId);
                return result != null ? result : 0;

            } else {
                // Legacy: try to parse as UUID (single order)
                log.info("Processing LEGACY payment reference as UUID");
                UUID orderId = UUID.fromString(paymentReference);
                Integer result = eventApiClient.handleOrderPaymentComplete(orderId);
                log.info("Event API returned {} items marked as paid for legacy order {}", result, orderId);
                return result != null ? result : 0;
            }
        } catch (IllegalArgumentException e) {
            log.warn("Invalid UUID in payment reference: {}", paymentReference, e);
            return 0;
        } catch (Exception e) {
            log.error("Error calling Event API for payment completion: {}", paymentReference, e);
            return 0;
        }
    }

    private String extractUuid(String reference, int prefixLength) {
        if (reference.length() >= prefixLength + UUID_LENGTH) {
            return reference.substring(prefixLength, prefixLength + UUID_LENGTH);
        }
        return reference.substring(prefixLength);
    }

    /**
     * Calculates the total unpaid amount for an order.
     */
    public BigDecimal calculateOrderUnpaidAmount(UUID orderId) {
        try {
            BigDecimal amount = eventApiClient.getOrderUnpaidAmount(orderId);
            log.info("Order {} unpaid amount: {}", orderId, amount);
            return amount != null ? amount : BigDecimal.ZERO;
        } catch (Exception e) {
            log.error("Error getting order unpaid amount from Event API: {}", orderId, e);
            return BigDecimal.ZERO;
        }
    }

    /**
     * Calculates the total unpaid amount for a registration.
     */
    public BigDecimal calculateRegistrationUnpaidAmount(UUID registrationId) {
        try {
            BigDecimal amount = eventApiClient.getRegistrationUnpaidAmount(registrationId);
            log.info("Registration {} unpaid amount: {}", registrationId, amount);
            return amount != null ? amount : BigDecimal.ZERO;
        } catch (Exception e) {
            log.error("Error getting registration unpaid amount from Event API: {}", registrationId, e);
            return BigDecimal.ZERO;
        }
    }

    /**
     * Calculates the total unpaid amount for an order point.
     */
    public BigDecimal calculateOrderPointUnpaidAmount(UUID orderPointId) {
        try {
            BigDecimal amount = eventApiClient.getOrderPointUnpaidAmount(orderPointId);
            log.info("Order point {} unpaid amount: {}", orderPointId, amount);
            return amount != null ? amount : BigDecimal.ZERO;
        } catch (Exception e) {
            log.error("Error getting order point unpaid amount from Event API: {}", orderPointId, e);
            return BigDecimal.ZERO;
        }
    }

    /**
     * Saves tip for a single order.
     */
    public void saveTipForOrder(UUID orderId, BigDecimal tip) {
        try {
            eventApiClient.saveTipForOrder(orderId, tip);
            log.info("Saved tip {} for order {}", tip, orderId);
        } catch (Exception e) {
            log.error("Error saving tip for order {}: {}", orderId, e.getMessage());
        }
    }

    /**
     * Saves tip for all orders of a registration.
     */
    public void saveTipForRegistration(UUID registrationId, BigDecimal tip) {
        try {
            eventApiClient.saveTipForRegistration(registrationId, tip);
            log.info("Saved tip {} for registration {}", tip, registrationId);
        } catch (Exception e) {
            log.error("Error saving tip for registration {}: {}", registrationId, e.getMessage());
        }
    }

    /**
     * Saves tip for all orders at an order point.
     */
    public void saveTipForOrderPoint(UUID orderPointId, BigDecimal tip) {
        try {
            eventApiClient.saveTipForOrderPoint(orderPointId, tip);
            log.info("Saved tip {} for order point {}", tip, orderPointId);
        } catch (Exception e) {
            log.error("Error saving tip for order point {}: {}", orderPointId, e.getMessage());
        }
    }
}
