package com.servio.event.listener;

import com.servio.event.dto.WebSocketNotification;
import com.servio.event.dto.sqs.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {

    private final SimpMessagingTemplate messagingTemplate;

    @Async("eventExecutor")
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        log.info("Handling order created event: orderId={}, orderNo={}", event.getOrderId(), event.getOrderNo());

        WebSocketNotification notification = WebSocketNotification.builder()
                .type("ORDER_CREATED")
                .orderId(event.getOrderId())
                .orderNo(event.getOrderNo())
                .message("New order #" + event.getOrderNo() + " created")
                .eventId(event.getEventId())
                .orderPointId(event.getOrderPointId())
                .build();

        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "orders");
        // ACTIVE pay-later orders need to appear in the payments view in real time too.
        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "payments");
    }

    @Async("eventExecutor")
    @EventListener
    public void handleOrderStatusChanged(OrderStatusChangedEvent event) {
        log.info("Handling order status changed: orderId={}, {} -> {}",
                event.getOrderId(), event.getPreviousStatus(), event.getNewStatus());

        WebSocketNotification notification = WebSocketNotification.builder()
                .orderId(event.getOrderId())
                .orderNo(event.getOrderNo())
                .eventId(event.getEventId())
                .orderPointId(event.getOrderPointId())
                .registrationId(event.getRegistrationId())
                .build();

        switch (event.getNewStatus()) {
            case "IN_PROGRESS" -> {
                notification.setType("ORDER_TAKEN");
                notification.setMessage("Order #" + event.getOrderNo() + " has been taken");
            }
            case "READY" -> {
                notification.setType("ORDER_READY");
                notification.setMessage("Order #" + event.getOrderNo() + " is ready for pickup");
            }
            case "DELIVERED" -> {
                notification.setType("ORDER_DELIVERED");
                notification.setMessage("Order #" + event.getOrderNo() + " has been picked up");
                notification.setOrderClosed(true);
            }
            case "CANCELLED" -> {
                notification.setType("ORDER_CANCELLED");
                notification.setMessage("Order #" + event.getOrderNo() + " has been cancelled");
                notification.setOrderClosed(true);
                // Cancellation removes the order from the payments view; broadcast there too.
                notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "payments");
            }
            case "ACTIVE" -> {
                if ("IN_PROGRESS".equals(event.getPreviousStatus())) {
                    notification.setType("ORDER_RETURNED");
                    notification.setMessage("Order #" + event.getOrderNo() + " has been returned to queue");
                } else {
                    return;
                }
            }
            default -> {
                return;
            }
        }

        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "orders");
    }

    @Async("eventExecutor")
    @EventListener
    public void handleOrderItemStatusChanged(OrderItemStatusChangedEvent event) {
        log.info("Handling order item status changed: itemId={}, {} -> {}",
                event.getItemId(), event.getPreviousStatus(), event.getNewStatus());

        WebSocketNotification notification = WebSocketNotification.builder()
                .orderId(event.getOrderId())
                .orderNo(event.getOrderNo())
                .itemName(event.getItemName())
                .eventId(event.getEventId())
                .orderPointId(event.getOrderPointId())
                .build();

        switch (event.getNewStatus()) {
            case "CANCELLED" -> {
                notification.setType("ITEM_CANCELLED");
                notification.setMessage(event.getItemName() + " has been cancelled");
            }
            default -> {
                return;
            }
        }

        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "orders");
    }

    @Async("eventExecutor")
    @EventListener
    public void handlePaymentCompleted(PaymentCompletedEvent event) {
        log.info("Handling payment completed: eventId={}, orderPointId={}, itemsPaid={}",
                event.getEventId(), event.getOrderPointId(), event.getItemsMarkedPaid());

        WebSocketNotification notification = WebSocketNotification.builder()
                .type("PAYMENT_COMPLETE")
                .message("Payment completed, " + event.getItemsMarkedPaid() + " items marked as paid")
                .eventId(event.getEventId())
                .orderPointId(event.getOrderPointId())
                .build();

        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "payments");
    }

    @Async("eventExecutor")
    @EventListener
    public void handleValidationRequested(ValidationRequestedEvent event) {
        log.info("Handling validation requested: registrationId={}, orderPointId={}",
                event.getRegistrationId(), event.getOrderPointId());

        WebSocketNotification notification = WebSocketNotification.builder()
                .type("VALIDATION_REQUESTED")
                .message("New validation request from " + (event.getNickname() != null ? event.getNickname() : "guest"))
                .registrationId(event.getRegistrationId())
                .orderPointId(event.getOrderPointId())
                .eventId(event.getEventId())
                .nickname(event.getNickname())
                .orderPointName(event.getOrderPointName())
                .build();

        notifyEventAndOrderPoint(event.getEventId(), event.getOrderPointId(), notification, "validation-requests");
    }

    private void notifyEventAndOrderPoint(UUID eventId, UUID orderPointId, WebSocketNotification notification, String subtopic) {
        if (eventId != null) {
            String destination = "/topic/event/" + eventId + "/" + subtopic;
            log.debug("Sending to {}: {}", destination, notification.getType());
            messagingTemplate.convertAndSend(destination, notification);
        }
        if (orderPointId != null) {
            String destination = "/topic/orderpoint/" + orderPointId + "/" + subtopic;
            log.debug("Sending to {}: {}", destination, notification.getType());
            messagingTemplate.convertAndSend(destination, notification);
        }
    }
}