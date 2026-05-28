package com.servio.event.service;

import com.servio.event.dto.ProtocolPaymentSummary;
import com.servio.event.entity.EventOrderPointEntity;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.repository.EventOrderPointRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lists PROTOCOL-paid orders for the mobile Approvals page. Joins with the
 * per-event order point row to surface the configured client name (Edit Event
 * → Order Points → Client column) — the customer-on-the-receipt isn't the
 * paying party for a protocol payment.
 */
@Service
@RequiredArgsConstructor
public class ProtocolPaymentService {

    /** Mirrors the marker used by the Collect modal frontend. */
    private static final String PAYMENT_METHOD_PROTOCOL = "PROTOCOL";

    private final OrderRepository orderRepository;
    private final OrderPointRepository orderPointRepository;
    private final EventOrderPointRepository eventOrderPointRepository;

    @Transactional(readOnly = true)
    public List<ProtocolPaymentSummary> listForEvent(UUID eventId) {
        List<OrderEntity> orders = orderRepository.findByEventIdAndPaymentMethod(eventId, PAYMENT_METHOD_PROTOCOL);
        if (orders.isEmpty()) {
            return List.of();
        }

        Set<UUID> orderPointIds = orders.stream()
                .map(OrderEntity::getOrderPointId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));

        Map<UUID, String> orderPointNames = orderPointRepository.findAllById(orderPointIds).stream()
                .collect(Collectors.toMap(OrderPointEntity::getId, OrderPointEntity::getName));

        // EventOrderPointEntity holds the per-event client name that the
        // backoffice sets in the Order Points tab. Pull all rows for this
        // event at once to avoid an N+1 lookup.
        Map<UUID, String> clientNameByOrderPointId = eventOrderPointRepository.findByEventIdWithDetails(eventId).stream()
                .filter(e -> e.getClientName() != null && !e.getClientName().isBlank())
                .collect(Collectors.toMap(
                        e -> e.getOrderPoint().getId(),
                        EventOrderPointEntity::getClientName,
                        (a, b) -> a));

        List<ProtocolPaymentSummary> result = new ArrayList<>(orders.size());
        for (OrderEntity order : orders) {
            ProtocolPaymentSummary row = new ProtocolPaymentSummary();
            row.setOrderId(order.getId());
            row.setOrderNo(order.getOrderNo());
            row.setPaidAt(order.getPaidAt());
            row.setPaidBy(order.getPaidBy());
            row.setTotalAmount(totalOf(order));
            row.setOrderPointId(order.getOrderPointId());
            if (order.getOrderPointId() != null) {
                row.setOrderPointName(orderPointNames.get(order.getOrderPointId()));
                row.setClientName(clientNameByOrderPointId.get(order.getOrderPointId()));
            }
            result.add(row);
        }
        return result;
    }

    private BigDecimal totalOf(OrderEntity order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            return BigDecimal.ZERO;
        }
        return order.getItems().stream()
                .filter(i -> i.getStatus() != OrderItemStatus.CANCELLED)
                .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}