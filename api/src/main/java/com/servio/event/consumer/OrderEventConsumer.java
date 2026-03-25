package com.servio.event.consumer;

import com.servio.event.dto.OrderNotification;
import com.servio.event.dto.kafka.OrderCreatedEvent;
import com.servio.event.dto.kafka.OrderItemStatusChangedEvent;
import com.servio.event.dto.kafka.OrderStatusChangedEvent;
import com.servio.event.dto.kafka.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventConsumer {

    private final SimpMessagingTemplate messagingTemplate;

    @KafkaListener(topics = "${kafka.topics.order-created:order.created}", groupId = "event-api")
    public void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Received order created event: {}", event);

        UUID eventId = event.getEventId();
        UUID orderPointId = event.getOrderPointId();
        Integer orderNo = event.getOrderNo();

        if (eventId != null) {
            OrderNotification notification = OrderNotification.builder()
                    .type("ORDER_CREATED")
                    .orderId(event.getOrderId())
                    .orderNo(orderNo)
                    .message("New order #" + orderNo + " created")
                    .build();

            String eventDestination = "/topic/event/" + eventId + "/orders";
            log.info("Sending order created notification to {}", eventDestination);
            messagingTemplate.convertAndSend(eventDestination, notification);

            if (orderPointId != null) {
                String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/orders";
                messagingTemplate.convertAndSend(orderPointDestination, notification);
            }
        }
    }

    @KafkaListener(topics = "${kafka.topics.order-status-changed:order.status.changed}", groupId = "event-api")
    public void handleOrderStatusChanged(OrderStatusChangedEvent event) {
        log.info("Received order status changed event: {}", event);

        UUID registrationId = event.getRegistrationId();
        UUID eventId = event.getEventId();
        UUID orderPointId = event.getOrderPointId();
        Integer orderNo = event.getOrderNo();
        String previousStatus = event.getPreviousStatus();
        String newStatus = event.getNewStatus();

        OrderNotification notification = OrderNotification.builder()
                .orderId(event.getOrderId())
                .orderNo(orderNo)
                .build();

        switch (newStatus) {
            case "IN_PROGRESS" -> {
                notification.setType("ORDER_TAKEN");
                notification.setMessage("Order #" + orderNo + " has been taken");
            }
            case "READY" -> {
                notification.setType("ORDER_READY");
                notification.setMessage("Order #" + orderNo + " is ready for pickup");
            }
            case "DELIVERED" -> {
                notification.setType("ORDER_DELIVERED");
                notification.setMessage("Order #" + orderNo + " has been picked up");
                notification.setOrderClosed(true);
            }
            case "CANCELLED" -> {
                notification.setType("ORDER_CANCELLED");
                notification.setMessage("Order #" + orderNo + " has been cancelled");
                notification.setOrderClosed(true);
            }
            case "ACTIVE" -> {
                if ("IN_PROGRESS".equals(previousStatus)) {
                    notification.setType("ORDER_RETURNED");
                    notification.setMessage("Order #" + orderNo + " has been returned to queue");
                } else {
                    return;
                }
            }
            default -> {
                return;
            }
        }

        if (registrationId != null) {
            String registrationDestination = "/topic/registration/" + registrationId;
            log.info("Sending order status notification to {}", registrationDestination);
            messagingTemplate.convertAndSend(registrationDestination, notification);
        }

        if (eventId != null) {
            String eventDestination = "/topic/event/" + eventId + "/orders";
            messagingTemplate.convertAndSend(eventDestination, notification);
        }
        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/orders";
            messagingTemplate.convertAndSend(orderPointDestination, notification);
        }
    }

    @KafkaListener(topics = "${kafka.topics.order-item-status-changed:order.item.status.changed}", groupId = "event-api")
    public void handleOrderItemStatusChanged(OrderItemStatusChangedEvent event) {
        log.info("Received order item status changed event: {}", event);

        UUID eventId = event.getEventId();
        UUID orderPointId = event.getOrderPointId();
        Integer orderNo = event.getOrderNo();
        String itemName = event.getItemName();
        String newStatus = event.getNewStatus();

        OrderNotification notification = OrderNotification.builder()
                .orderId(event.getOrderId())
                .orderNo(orderNo)
                .itemName(itemName)
                .build();

        switch (newStatus) {
            case "PREPARING" -> {
                notification.setType("ITEM_STARTED");
                notification.setMessage(itemName + " is being prepared");
            }
            case "CANCELLED" -> {
                notification.setType("ITEM_CANCELLED");
                notification.setMessage(itemName + " has been cancelled");
            }
            default -> {
                return;
            }
        }

        if (eventId != null) {
            String eventDestination = "/topic/event/" + eventId + "/orders";
            messagingTemplate.convertAndSend(eventDestination, notification);
        }
        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/orders";
            messagingTemplate.convertAndSend(orderPointDestination, notification);
        }
    }

    @KafkaListener(topics = "${kafka.topics.payment-completed:payment.completed}", groupId = "event-api")
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        log.info("Received payment completed event: {}", event);

        UUID eventId = event.getEventId();
        UUID orderPointId = event.getOrderPointId();
        Integer itemsMarkedPaid = event.getItemsMarkedPaid();

        OrderNotification notification = OrderNotification.builder()
                .type("PAYMENT_COMPLETE")
                .message("Payment completed, " + itemsMarkedPaid + " items marked as paid")
                .build();

        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/payments";
            log.info("Sending payment notification to {}", orderPointDestination);
            messagingTemplate.convertAndSend(orderPointDestination, notification);
        }

        if (eventId != null) {
            String eventDestination = "/topic/event/" + eventId + "/payments";
            log.info("Sending payment notification to {}", eventDestination);
            messagingTemplate.convertAndSend(eventDestination, notification);
        }
    }
}
