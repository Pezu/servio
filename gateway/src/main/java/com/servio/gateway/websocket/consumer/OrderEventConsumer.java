package com.servio.gateway.websocket.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.servio.gateway.websocket.dto.WebSocketNotification;
import com.servio.gateway.websocket.dto.sqs.*;
import com.servio.gateway.websocket.service.WebSocketService;
import io.awspring.cloud.sqs.annotation.SqsListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderEventConsumer {

    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;

    @SqsListener("${sqs.queues.order-created}")
    public void handleOrderCreated(String message) {
        try {
            OrderCreatedEvent event = objectMapper.readValue(message, OrderCreatedEvent.class);
            log.info("Received order created event: {}", event);

            UUID eventId = event.getEventId();
            UUID orderPointId = event.getOrderPointId();
            Integer orderNo = event.getOrderNo();

            WebSocketNotification notification = WebSocketNotification.builder()
                    .type("ORDER_CREATED")
                    .orderId(event.getOrderId())
                    .orderNo(orderNo)
                    .message("New order #" + orderNo + " created")
                    .eventId(eventId)
                    .orderPointId(orderPointId)
                    .build();

            if (eventId != null) {
                webSocketService.notifyEvent(eventId, notification);
            }

            if (orderPointId != null) {
                webSocketService.notifyOrderPoint(orderPointId, notification);
            }
        } catch (Exception e) {
            log.error("Failed to process order created event: {}", e.getMessage(), e);
        }
    }

    @SqsListener("${sqs.queues.order-status-changed}")
    public void handleOrderStatusChanged(String message) {
        try {
            OrderStatusChangedEvent event = objectMapper.readValue(message, OrderStatusChangedEvent.class);
            log.info("Received order status changed event: {}", event);

            UUID registrationId = event.getRegistrationId();
            UUID eventId = event.getEventId();
            UUID orderPointId = event.getOrderPointId();
            Integer orderNo = event.getOrderNo();
            String previousStatus = event.getPreviousStatus();
            String newStatus = event.getNewStatus();

            WebSocketNotification notification = WebSocketNotification.builder()
                    .orderId(event.getOrderId())
                    .orderNo(orderNo)
                    .eventId(eventId)
                    .orderPointId(orderPointId)
                    .registrationId(registrationId)
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
                webSocketService.notifyRegistration(registrationId, notification);
            }

            if (eventId != null) {
                webSocketService.notifyEvent(eventId, notification);
            }
            if (orderPointId != null) {
                webSocketService.notifyOrderPoint(orderPointId, notification);
            }
        } catch (Exception e) {
            log.error("Failed to process order status changed event: {}", e.getMessage(), e);
        }
    }

    @SqsListener("${sqs.queues.order-item-status-changed}")
    public void handleOrderItemStatusChanged(String message) {
        try {
            OrderItemStatusChangedEvent event = objectMapper.readValue(message, OrderItemStatusChangedEvent.class);
            log.info("Received order item status changed event: {}", event);

            UUID eventId = event.getEventId();
            UUID orderPointId = event.getOrderPointId();
            Integer orderNo = event.getOrderNo();
            String itemName = event.getItemName();
            String newStatus = event.getNewStatus();

            WebSocketNotification notification = WebSocketNotification.builder()
                    .orderId(event.getOrderId())
                    .orderNo(orderNo)
                    .itemName(itemName)
                    .eventId(eventId)
                    .orderPointId(orderPointId)
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
                webSocketService.notifyEvent(eventId, notification);
            }
            if (orderPointId != null) {
                webSocketService.notifyOrderPoint(orderPointId, notification);
            }
        } catch (Exception e) {
            log.error("Failed to process order item status changed event: {}", e.getMessage(), e);
        }
    }

    @SqsListener("${sqs.queues.payment-completed}")
    public void handlePaymentCompleted(String message) {
        try {
            PaymentCompletedEvent event = objectMapper.readValue(message, PaymentCompletedEvent.class);
            log.info(">>> PAYMENT EVENT RECEIVED: eventId={}, orderPointId={}, itemsPaid={}",
                    event.getEventId(), event.getOrderPointId(), event.getItemsMarkedPaid());

            UUID eventId = event.getEventId();
            UUID orderPointId = event.getOrderPointId();
            Integer itemsMarkedPaid = event.getItemsMarkedPaid();

            WebSocketNotification notification = WebSocketNotification.builder()
                    .type("PAYMENT_COMPLETE")
                    .message("Payment completed, " + itemsMarkedPaid + " items marked as paid")
                    .eventId(eventId)
                    .orderPointId(orderPointId)
                    .build();

            webSocketService.notifyPayment(eventId, orderPointId, notification);
        } catch (Exception e) {
            log.error("Failed to process payment completed event: {}", e.getMessage(), e);
        }
    }

    @SqsListener("${sqs.queues.registration-validated}")
    public void handleRegistrationValidated(String message) {
        try {
            RegistrationValidatedEvent event = objectMapper.readValue(message, RegistrationValidatedEvent.class);
            log.info("Received registration validated event: {}", event);

            UUID registrationId = event.getRegistrationId();
            Boolean validated = event.getValidated();

            if (registrationId != null && Boolean.TRUE.equals(validated)) {
                WebSocketNotification notification = WebSocketNotification.builder()
                        .type("REGISTRATION_VALIDATED")
                        .message("Your registration has been approved")
                        .registrationId(registrationId)
                        .build();

                webSocketService.notifyRegistration(registrationId, notification);
            }
        } catch (Exception e) {
            log.error("Failed to process registration validated event: {}", e.getMessage(), e);
        }
    }

    @SqsListener("${sqs.queues.validation-requested}")
    public void handleValidationRequested(String message) {
        try {
            ValidationRequestedEvent event = objectMapper.readValue(message, ValidationRequestedEvent.class);
            log.info("Received validation requested event: {}", event);

            UUID eventId = event.getEventId();
            UUID orderPointId = event.getOrderPointId();
            UUID registrationId = event.getRegistrationId();
            String nickname = event.getNickname();
            String orderPointName = event.getOrderPointName();

            WebSocketNotification notification = WebSocketNotification.builder()
                    .type("VALIDATION_REQUESTED")
                    .message("New validation request from " + (nickname != null ? nickname : "guest"))
                    .registrationId(registrationId)
                    .orderPointId(orderPointId)
                    .eventId(eventId)
                    .nickname(nickname)
                    .orderPointName(orderPointName)
                    .build();

            if (eventId != null) {
                webSocketService.notifyEvent(eventId, notification);
            }

            if (orderPointId != null) {
                webSocketService.notifyOrderPoint(orderPointId, notification);
            }
        } catch (Exception e) {
            log.error("Failed to process validation requested event: {}", e.getMessage(), e);
        }
    }
}
