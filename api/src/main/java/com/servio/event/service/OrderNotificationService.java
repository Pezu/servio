package com.servio.event.service;

import com.servio.event.dto.OrderNotification;
import com.servio.event.dto.kafka.OrderCreatedEvent;
import com.servio.event.dto.kafka.OrderItemStatusChangedEvent;
import com.servio.event.dto.kafka.OrderStatusChangedEvent;
import com.servio.event.dto.kafka.PaymentCompletedEvent;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderNotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.order-status-changed:order.status.changed}")
    private String orderStatusChangedTopic;

    @Value("${kafka.topics.order-item-status-changed:order.item.status.changed}")
    private String orderItemStatusChangedTopic;

    @Value("${kafka.topics.payment-completed:payment.completed}")
    private String paymentCompletedTopic;

    @Value("${kafka.topics.order-created:order.created}")
    private String orderCreatedTopic;

    public void notifyOrderStatusChange(OrderEntity order, OrderStatus previousStatus, OrderStatus newStatus) {
        UUID registrationId = order.getRegistrationId();

        OrderStatusChangedEvent event = OrderStatusChangedEvent.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .registrationId(registrationId)
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .previousStatus(previousStatus.name())
                .newStatus(newStatus.name())
                .build();

        publishToKafka(orderStatusChangedTopic, event);

        OrderNotification notification = OrderNotification.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .build();

        switch (newStatus) {
            case IN_PROGRESS -> {
                notification.setType("ORDER_TAKEN");
                notification.setMessage("Order #" + order.getOrderNo() + " has been taken");
            }
            case READY -> {
                notification.setType("ORDER_READY");
                notification.setMessage("Order #" + order.getOrderNo() + " is ready for pickup");
            }
            case DELIVERED -> {
                notification.setType("ORDER_DELIVERED");
                notification.setMessage("Order #" + order.getOrderNo() + " has been picked up");
                notification.setOrderClosed(true);
            }
            case CANCELLED -> {
                notification.setType("ORDER_CANCELLED");
                notification.setMessage("Order #" + order.getOrderNo() + " has been cancelled");
                notification.setOrderClosed(true);
            }
            case ACTIVE -> {
                if (previousStatus == OrderStatus.IN_PROGRESS) {
                    notification.setType("ORDER_RETURNED");
                    notification.setMessage("Order #" + order.getOrderNo() + " has been returned to queue");
                } else {
                    return;
                }
            }
            default -> {
                return;
            }
        }

        sendNotification(registrationId, notification);
    }

    public void notifyItemStatusChange(OrderItemEntity item, OrderItemStatus previousStatus, OrderItemStatus newStatus) {
        OrderEntity order = item.getOrder();
        UUID registrationId = order.getRegistrationId();

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

        publishToKafka(orderItemStatusChangedTopic, event);

        OrderNotification notification = OrderNotification.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .itemName(item.getName())
                .build();

        switch (newStatus) {
            case PREPARING -> {
                notification.setType("ITEM_STARTED");
                notification.setMessage(item.getName() + " is being prepared");
            }
            case CANCELLED -> {
                notification.setType("ITEM_CANCELLED");
                notification.setMessage(item.getName() + " has been cancelled");
            }
            default -> {
                return;
            }
        }

        sendNotification(registrationId, notification);
    }

    private void sendNotification(UUID registrationId, OrderNotification notification) {
        String destination = "/topic/registration/" + registrationId;
        log.info("Sending notification to {}: {}", destination, notification);
        messagingTemplate.convertAndSend(destination, notification);
    }

    public void notifyPaymentComplete(UUID eventId, UUID orderPointId, int itemsMarkedPaid) {
        PaymentCompletedEvent event = PaymentCompletedEvent.builder()
                .eventId(eventId)
                .orderPointId(orderPointId)
                .itemsMarkedPaid(itemsMarkedPaid)
                .build();

        publishToKafka(paymentCompletedTopic, event);

        OrderNotification notification = OrderNotification.builder()
                .type("PAYMENT_COMPLETE")
                .message("Payment completed, " + itemsMarkedPaid + " items marked as paid")
                .build();

        String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/payments";
        messagingTemplate.convertAndSend(orderPointDestination, notification);

        if (eventId != null) {
            String eventDestination = "/topic/event/" + eventId + "/payments";
            messagingTemplate.convertAndSend(eventDestination, notification);
        }
    }

    public void notifyOrderCreated(OrderEntity order) {
        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .registrationId(order.getRegistrationId())
                .build();

        publishToKafka(orderCreatedTopic, event);
    }

    private void publishToKafka(String topic, Object event) {
        log.info("Publishing to Kafka topic {}: {}", topic, event);
        kafkaTemplate.send(topic, event);
    }
}
