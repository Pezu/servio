package com.servio.event.service;

import com.servio.event.dto.sqs.OrderCreatedEvent;
import com.servio.event.dto.sqs.OrderItemStatusChangedEvent;
import com.servio.event.dto.sqs.OrderStatusChangedEvent;
import com.servio.event.dto.sqs.PaymentCompletedEvent;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderNotificationService {

    private final ApplicationEventPublisher eventPublisher;

    public void notifyOrderStatusChange(OrderEntity order, OrderStatus previousStatus, OrderStatus newStatus) {
        OrderStatusChangedEvent event = OrderStatusChangedEvent.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .registrationId(order.getRegistrationId())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .previousStatus(previousStatus.name())
                .newStatus(newStatus.name())
                .build();

        log.info("Publishing order status changed event: orderId={}, {} -> {}",
                order.getId(), previousStatus, newStatus);
        eventPublisher.publishEvent(event);
    }

    public void notifyItemStatusChange(OrderItemEntity item, OrderItemStatus previousStatus, OrderItemStatus newStatus) {
        OrderEntity order = item.getOrder();

        OrderItemStatusChangedEvent event = OrderItemStatusChangedEvent.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .itemId(item.getId())
                .itemName(item.getName())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .previousStatus(previousStatus.name())
                .newStatus(newStatus.name())
                .build();

        log.info("Publishing order item status changed event: itemId={}, {} -> {}",
                item.getId(), previousStatus, newStatus);
        eventPublisher.publishEvent(event);
    }

    public void notifyPaymentComplete(UUID eventId, UUID orderPointId, int itemsMarkedPaid) {
        notifyPaymentCompletedInternal(eventId, orderPointId, null, itemsMarkedPaid);
    }

    public void notifyPaymentCompleted(OrderEntity order, int itemsMarkedPaid) {
        notifyPaymentCompletedInternal(order.getEventId(), order.getOrderPointId(), order.getId(), itemsMarkedPaid);
    }

    private void notifyPaymentCompletedInternal(UUID eventId, UUID orderPointId, UUID orderId, int itemsMarkedPaid) {
        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .eventId(eventId)
                .orderPointId(orderPointId)
                .orderId(orderId)
                .itemsMarkedPaid(itemsMarkedPaid)
                .build();

        log.info("Publishing payment completed event: eventId={}, orderPointId={}, items={}",
                eventId, orderPointId, itemsMarkedPaid);
        eventPublisher.publishEvent(event);
    }

    public void notifyOrderCreated(OrderEntity order) {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .registrationId(order.getRegistrationId())
                .build();

        log.info("Publishing order created event: orderId={}, orderNo={}",
                order.getId(), order.getOrderNo());
        eventPublisher.publishEvent(event);
    }
}
