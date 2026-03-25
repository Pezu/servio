package com.servio.gateway.websocket.service;

import com.servio.gateway.websocket.config.WebSocketRedisConfig;
import com.servio.gateway.websocket.dto.RedisNotificationMessage;
import com.servio.gateway.websocket.dto.WebSocketNotification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Sends notification to a specific destination.
     * Also publishes to Redis for other instances.
     */
    public void sendNotification(String destination, WebSocketNotification notification) {
        log.debug("Sending notification to {}: {}", destination, notification.getType());

        // Send locally
        messagingTemplate.convertAndSend(destination, notification);

        // Publish to Redis for other instances
        RedisNotificationMessage message = RedisNotificationMessage.builder()
                .destination(destination)
                .notification(notification)
                .build();
        redisTemplate.convertAndSend(WebSocketRedisConfig.WEBSOCKET_CHANNEL, message);
    }

    /**
     * Sends notification to event topic.
     */
    public void notifyEvent(UUID eventId, WebSocketNotification notification) {
        String subtopic = getSubtopicForType(notification.getType());
        String destination = "/topic/event/" + eventId + "/" + subtopic;
        sendNotificationLocal(destination, notification);
    }

    /**
     * Sends notification to order point topic.
     */
    public void notifyOrderPoint(UUID orderPointId, WebSocketNotification notification) {
        String subtopic = getSubtopicForType(notification.getType());
        String destination = "/topic/orderpoint/" + orderPointId + "/" + subtopic;
        sendNotificationLocal(destination, notification);
    }

    private String getSubtopicForType(String type) {
        if ("VALIDATION_REQUESTED".equals(type)) {
            return "validation-requests";
        } else if ("REGISTRATION_APPROVED".equals(type)) {
            return "registrations";
        }
        return "orders";
    }

    /**
     * Sends notification to registration topic (customer).
     */
    public void notifyRegistration(UUID registrationId, WebSocketNotification notification) {
        String destination = "/topic/registration/" + registrationId;
        sendNotificationLocal(destination, notification);
    }

    /**
     * Sends payment notification to event and order point.
     */
    public void notifyPayment(UUID eventId, UUID orderPointId, WebSocketNotification notification) {
        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/payments";
            sendNotificationLocal(orderPointDestination, notification);
        }
        if (eventId != null) {
            String eventDestination = "/topic/event/" + eventId + "/payments";
            sendNotificationLocal(eventDestination, notification);
        }
    }

    /**
     * Send notification locally only (used by Redis subscriber to avoid loop).
     */
    public void sendNotificationLocal(String destination, WebSocketNotification notification) {
        log.debug("Sending local notification to {}: {}", destination, notification.getType());
        messagingTemplate.convertAndSend(destination, notification);
    }
}
