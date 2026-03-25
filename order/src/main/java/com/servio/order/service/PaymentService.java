package com.servio.order.service;

import com.servio.order.entity.OrderEntity;
import com.servio.order.entity.OrderItemStatus;
import com.servio.order.event.PaymentCompletedEvent;
import com.servio.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final OrderRepository orderRepository;
    private final KafkaProducerService kafkaProducerService;

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
     * Returns the number of items marked as paid.
     */
    @Transactional
    public int handlePaymentComplete(String paymentReference) {
        log.info("Processing payment completion for reference: {}", paymentReference);

        PaymentCompletedEvent.PaymentType paymentType;
        UUID eventId = null;
        UUID orderPointId = null;
        UUID registrationId = null;
        UUID orderId = null;
        BigDecimal amount = BigDecimal.ZERO;
        int itemsMarkedPaid = 0;

        if (paymentReference.startsWith(PREFIX_ORDER)) {
            String orderIdStr = extractUuid(paymentReference, PREFIX_ORDER.length());
            log.info("Processing ORDER payment, orderId: {}", orderIdStr);
            try {
                orderId = UUID.fromString(orderIdStr);
                paymentType = PaymentCompletedEvent.PaymentType.ORDER;
                var result = markOrderItemsAsPaid(orderId);
                itemsMarkedPaid = result.itemsMarked;
                eventId = result.eventId;
                orderPointId = result.orderPointId;
                amount = result.amount;
            } catch (IllegalArgumentException e) {
                log.warn("Invalid order ID in payment reference: {}", paymentReference);
                return 0;
            }
        } else if (paymentReference.startsWith(PREFIX_GUEST)) {
            String registrationIdStr = extractUuid(paymentReference, PREFIX_GUEST.length());
            log.info("Processing GUEST payment, registrationId: {}", registrationIdStr);
            try {
                registrationId = UUID.fromString(registrationIdStr);
                paymentType = PaymentCompletedEvent.PaymentType.GUEST;
                var result = markGuestOrdersAsPaid(registrationId);
                itemsMarkedPaid = result.itemsMarked;
                eventId = result.eventId;
                orderPointId = result.orderPointId;
                amount = result.amount;
            } catch (IllegalArgumentException e) {
                log.error("Invalid registration ID in GUEST payment reference: {}", paymentReference, e);
                return 0;
            }
        } else if (paymentReference.startsWith(PREFIX_ORDERPOINT)) {
            String orderPointIdStr = extractUuid(paymentReference, PREFIX_ORDERPOINT.length());
            log.info("Processing ORDERPOINT payment, orderPointId: {}", orderPointIdStr);
            try {
                orderPointId = UUID.fromString(orderPointIdStr);
                paymentType = PaymentCompletedEvent.PaymentType.ORDERPOINT;
                var result = markOrderPointOrdersAsPaid(orderPointId);
                itemsMarkedPaid = result.itemsMarked;
                eventId = result.eventId;
                amount = result.amount;
            } catch (IllegalArgumentException e) {
                log.warn("Invalid order point ID in payment reference: {}", paymentReference);
                return 0;
            }
        } else {
            // Legacy: try to parse as UUID (single order)
            log.info("Processing LEGACY payment reference as UUID");
            try {
                orderId = UUID.fromString(paymentReference);
                paymentType = PaymentCompletedEvent.PaymentType.ORDER;
                var result = markOrderItemsAsPaid(orderId);
                itemsMarkedPaid = result.itemsMarked;
                eventId = result.eventId;
                orderPointId = result.orderPointId;
                amount = result.amount;
            } catch (IllegalArgumentException e) {
                log.warn("Unknown payment reference format: {}", paymentReference);
                return 0;
            }
        }

        // Publish Kafka event for payment completion
        if (itemsMarkedPaid > 0) {
            PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                    .paymentReference(paymentReference)
                    .paymentType(paymentType)
                    .eventId(eventId)
                    .orderPointId(orderPointId)
                    .registrationId(registrationId)
                    .orderId(orderId)
                    .amount(amount)
                    .itemsMarkedPaid(itemsMarkedPaid)
                    .completedAt(LocalDateTime.now())
                    .build();

            kafkaProducerService.publishPaymentCompleted(event);
        }

        return itemsMarkedPaid;
    }

    private String extractUuid(String reference, int prefixLength) {
        if (reference.length() >= prefixLength + UUID_LENGTH) {
            return reference.substring(prefixLength, prefixLength + UUID_LENGTH);
        }
        return reference.substring(prefixLength);
    }

    private record PaymentResult(int itemsMarked, UUID eventId, UUID orderPointId, BigDecimal amount) {}

    private PaymentResult markOrderItemsAsPaid(UUID orderId) {
        var orderOpt = orderRepository.findByIdWithItems(orderId);
        if (orderOpt.isPresent()) {
            OrderEntity order = orderOpt.get();
            var result = markOrderAsPaid(order);
            return new PaymentResult(result.itemsMarked, order.getEventId(), order.getOrderPointId(), result.amount);
        }
        log.warn("Order not found: {}", orderId);
        return new PaymentResult(0, null, null, BigDecimal.ZERO);
    }

    private PaymentResult markGuestOrdersAsPaid(UUID registrationId) {
        List<OrderEntity> orders = orderRepository.findByRegistrationIdWithItems(registrationId);
        log.info("Found {} orders for registration {}", orders.size(), registrationId);

        int totalItemsMarked = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        UUID orderPointId = null;
        UUID eventId = null;

        for (OrderEntity order : orders) {
            var result = markOrderAsPaid(order);
            totalItemsMarked += result.itemsMarked;
            totalAmount = totalAmount.add(result.amount);
            if (orderPointId == null) orderPointId = order.getOrderPointId();
            if (eventId == null) eventId = order.getEventId();
        }

        log.info("Total items marked as paid for registration {}: {}", registrationId, totalItemsMarked);
        return new PaymentResult(totalItemsMarked, eventId, orderPointId, totalAmount);
    }

    private PaymentResult markOrderPointOrdersAsPaid(UUID orderPointId) {
        List<OrderEntity> orders = orderRepository.findByOrderPointIdOrderByCreatedAtDesc(orderPointId);
        log.info("Found {} orders at order point {}", orders.size(), orderPointId);

        int totalItemsMarked = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        UUID eventId = null;

        for (OrderEntity order : orders) {
            // Fetch items for this order
            var orderWithItems = orderRepository.findByIdWithItems(order.getId());
            if (orderWithItems.isPresent()) {
                var result = markOrderAsPaid(orderWithItems.get());
                totalItemsMarked += result.itemsMarked;
                totalAmount = totalAmount.add(result.amount);
                if (eventId == null) eventId = order.getEventId();
            }
        }

        log.info("Total items marked as paid at order point: {}", totalItemsMarked);
        return new PaymentResult(totalItemsMarked, eventId, orderPointId, totalAmount);
    }

    private record MarkResult(int itemsMarked, BigDecimal amount) {}

    private MarkResult markOrderAsPaid(OrderEntity order) {
        int itemsMarkedPaid = 0;
        BigDecimal amount = BigDecimal.ZERO;

        log.info("Processing order {} with {} items", order.getId(), order.getItems().size());

        for (var item : order.getItems()) {
            log.info("  Item: {} status={} paid={}", item.getId(), item.getStatus(), item.isPaid());

            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }

            if (!item.isPaid()) {
                item.setPaid(true);
                itemsMarkedPaid++;
                amount = amount.add(item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
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
        return new MarkResult(itemsMarkedPaid, amount);
    }

    /**
     * Calculates the total unpaid amount for an order.
     */
    public BigDecimal calculateOrderUnpaidAmount(UUID orderId) {
        return orderRepository.findByIdWithItems(orderId)
                .map(order -> order.getItems().stream()
                        .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                        .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                        .reduce(BigDecimal.ZERO, BigDecimal::add))
                .orElse(BigDecimal.ZERO);
    }

    /**
     * Calculates the total unpaid amount for a registration.
     */
    public BigDecimal calculateRegistrationUnpaidAmount(UUID registrationId) {
        return orderRepository.findByRegistrationIdWithItems(registrationId).stream()
                .flatMap(order -> order.getItems().stream())
                .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Calculates the total unpaid amount for an order point.
     */
    public BigDecimal calculateOrderPointUnpaidAmount(UUID orderPointId) {
        return orderRepository.findByOrderPointIdOrderByCreatedAtDesc(orderPointId).stream()
                .flatMap(order -> orderRepository.findByIdWithItems(order.getId())
                        .map(o -> o.getItems().stream())
                        .orElse(java.util.stream.Stream.empty()))
                .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
