package com.tapello.event.service;

import com.tapello.event.dto.OrderNotification;
import com.tapello.event.entity.OrderEntity;
import com.tapello.event.entity.OrderItemEntity;
import com.tapello.event.entity.OrderItemStatus;
import com.tapello.event.entity.OrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void notifyOrderStatusChange(OrderEntity order, OrderStatus previousStatus, OrderStatus newStatus) {
        UUID registrationId = order.getRegistrationId();

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
            case DONE -> {
                notification.setType("ITEM_READY");
                notification.setMessage(item.getName() + " is ready");
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
}