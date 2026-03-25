package com.servio.gateway.websocket.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.servio.gateway.websocket.dto.RedisNotificationMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisMessageSubscriber implements MessageListener {

    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String messageBody = new String(message.getBody());
            log.debug("Received Redis message: {}", messageBody);

            RedisNotificationMessage notification = objectMapper.readValue(
                    messageBody, RedisNotificationMessage.class);

            // Send notification locally (don't republish to Redis to avoid loop)
            webSocketService.sendNotificationLocal(
                    notification.getDestination(),
                    notification.getNotification()
            );

        } catch (Exception e) {
            log.error("Error processing Redis message", e);
        }
    }
}
