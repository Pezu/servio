package com.servio.event.service;

import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final OrderRepository orderRepository;
    private final OrderNotificationService orderNotificationService;

    // Payment reference prefixes
    // Format: ORDER-{orderId}
    // Format: GUEST-{orderPointId}-{base64Nickname}
    // Format: ORDERPOINT-{orderPointId}
    private static final String PREFIX_ORDER = "ORDER-";
    private static final String PREFIX_GUEST = "GUEST-";
    private static final String PREFIX_ORDERPOINT = "ORDERPOINT-";

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
     * Creates a payment reference for all orders of a guest (registration) at an order point.
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

    /**
     * Generates a unique suffix for payment references to allow retries.
     */
    private String generateUniqueSuffix() {
        return Long.toHexString(System.currentTimeMillis());
    }

    private static final int UUID_LENGTH = 36; // Standard UUID format: 8-4-4-4-12

    /**
     * Handles payment completion based on the reference type.
     * Returns the number of items marked as paid.
     */
    @Transactional
    public int handlePaymentComplete(String paymentReference) {
        log.info("Processing payment completion for reference: {}", paymentReference);

        if (paymentReference.startsWith(PREFIX_ORDER)) {
            // Single order payment: ORDER-{orderId}-{timestamp}
            String orderIdStr = extractUuid(paymentReference, PREFIX_ORDER.length());
            log.info("Processing ORDER payment, orderId: {}", orderIdStr);
            try {
                UUID orderId = UUID.fromString(orderIdStr);
                return markOrderItemsAsPaid(orderId);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid order ID in payment reference: {}", paymentReference);
                return 0;
            }
        } else if (paymentReference.startsWith(PREFIX_GUEST)) {
            // Guest payment: GUEST-{registrationId}-{timestamp}
            String registrationIdStr = extractUuid(paymentReference, PREFIX_GUEST.length());
            log.info("Processing GUEST payment, registrationId: {}", registrationIdStr);
            try {
                UUID registrationId = UUID.fromString(registrationIdStr);
                return markGuestOrdersAsPaid(registrationId);
            } catch (IllegalArgumentException e) {
                log.error("Invalid registration ID in GUEST payment reference: {}", paymentReference, e);
                return 0;
            }
        } else if (paymentReference.startsWith(PREFIX_ORDERPOINT)) {
            // Order point payment: ORDERPOINT-{orderPointId}-{timestamp}
            String orderPointIdStr = extractUuid(paymentReference, PREFIX_ORDERPOINT.length());
            log.info("Processing ORDERPOINT payment, orderPointId: {}", orderPointIdStr);
            try {
                UUID orderPointId = UUID.fromString(orderPointIdStr);
                return markOrderPointOrdersAsPaid(orderPointId);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid order point ID in payment reference: {}", paymentReference);
                return 0;
            }
        } else {
            // Legacy: try to parse as UUID (single order)
            log.info("Processing LEGACY payment reference as UUID");
            try {
                UUID orderId = UUID.fromString(paymentReference);
                return markOrderItemsAsPaid(orderId);
            } catch (IllegalArgumentException e) {
                log.warn("Unknown payment reference format: {}", paymentReference);
                return 0;
            }
        }
    }

    /**
     * Extracts the UUID from a payment reference, handling optional timestamp suffix.
     */
    private String extractUuid(String reference, int prefixLength) {
        if (reference.length() >= prefixLength + UUID_LENGTH) {
            return reference.substring(prefixLength, prefixLength + UUID_LENGTH);
        }
        // Fallback for legacy references without timestamp
        return reference.substring(prefixLength);
    }

    /**
     * Marks all unpaid, non-cancelled items in a single order as paid.
     */
    private int markOrderItemsAsPaid(UUID orderId) {
        var orderOpt = orderRepository.findByIdWithItems(orderId);
        if (orderOpt.isPresent()) {
            OrderEntity order = orderOpt.get();
            int itemsMarked = markOrderAsPaid(order);
            if (itemsMarked > 0) {
                orderNotificationService.notifyPaymentComplete(order.getEventId(), order.getOrderPointId(), itemsMarked);
            }
            return itemsMarked;
        }
        log.warn("Order not found: {}", orderId);
        return 0;
    }

    /**
     * Marks all unpaid, non-cancelled items for a guest (registration) as paid.
     */
    private int markGuestOrdersAsPaid(UUID registrationId) {
        List<OrderEntity> orders = orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId);
        log.info("Found {} orders for registration {}", orders.size(), registrationId);
        int totalItemsMarked = 0;
        UUID orderPointId = null;
        UUID eventId = null;
        for (OrderEntity order : orders) {
            totalItemsMarked += markOrderAsPaid(order);
            // Track order point ID and event ID (all orders for a registration should be at the same order point/event)
            if (orderPointId == null && order.getOrderPointId() != null) {
                orderPointId = order.getOrderPointId();
            }
            if (eventId == null && order.getEventId() != null) {
                eventId = order.getEventId();
            }
        }
        log.info("Total items marked as paid for registration {}: {}", registrationId, totalItemsMarked);
        // Send payment notification
        if (totalItemsMarked > 0 && orderPointId != null) {
            orderNotificationService.notifyPaymentComplete(eventId, orderPointId, totalItemsMarked);
        }
        return totalItemsMarked;
    }

    /**
     * Marks all unpaid, non-cancelled items at an order point as paid (total).
     */
    private int markOrderPointOrdersAsPaid(UUID orderPointId) {
        List<OrderEntity> orders = orderRepository.findByOrderPointIdWithItems(orderPointId);
        log.info("Found {} orders at order point {}", orders.size(), orderPointId);
        int totalItemsMarked = 0;
        UUID eventId = null;
        for (OrderEntity order : orders) {
            totalItemsMarked += markOrderAsPaid(order);
            if (eventId == null && order.getEventId() != null) {
                eventId = order.getEventId();
            }
        }
        log.info("Total items marked as paid at order point: {}", totalItemsMarked);
        // Send payment notification
        if (totalItemsMarked > 0) {
            orderNotificationService.notifyPaymentComplete(eventId, orderPointId, totalItemsMarked);
        }
        return totalItemsMarked;
    }

    /**
     * Marks all unpaid, non-cancelled items in an order as paid and updates needsPayment flag.
     * Returns the number of items marked as paid.
     */
    private int markOrderAsPaid(OrderEntity order) {
        int itemsMarkedPaid = 0;
        log.info("Processing order {} with {} items", order.getId(), order.getItems().size());
        for (var item : order.getItems()) {
            log.info("  Item: {} status={} paid={}", item.getId(), item.getStatus(), item.isPaid());
            // Skip cancelled items - they shouldn't be marked as paid
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            if (!item.isPaid()) {
                item.setPaid(true);
                itemsMarkedPaid++;
                log.info("  -> Marked as paid");
            }
        }

        // Check if all non-cancelled items are now paid
        boolean allPaid = order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .allMatch(item -> item.isPaid());
        if (allPaid) {
            order.setNeedsPayment(false);
        }

        orderRepository.save(order);
        log.info("Marked {} items as paid in order {}, allPaid: {}", itemsMarkedPaid, order.getId(), allPaid);
        return itemsMarkedPaid;
    }
}
