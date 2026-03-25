package com.servio.gateway.websocket.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String CONNECTIONS_KEY = "websocket:connections";
    private static final String SUBSCRIPTIONS_KEY = "websocket:subscriptions";

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        log.info("WebSocket connected: sessionId={}", sessionId);

        // Track connection in Redis for monitoring
        redisTemplate.opsForSet().add(CONNECTIONS_KEY, sessionId);
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        log.info("WebSocket disconnected: sessionId={}", sessionId);

        // Remove from tracking
        redisTemplate.opsForSet().remove(CONNECTIONS_KEY, sessionId);
    }

    @EventListener
    public void handleSubscribeEvent(SessionSubscribeEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        String destination = headerAccessor.getDestination();

        log.info("WebSocket subscription: sessionId={}, destination={}", sessionId, destination);

        // Track subscriptions for monitoring
        if (destination != null) {
            redisTemplate.opsForHash().increment(SUBSCRIPTIONS_KEY, destination, 1);
        }
    }

    /**
     * Gets the current number of active connections.
     */
    public long getActiveConnections() {
        Long size = redisTemplate.opsForSet().size(CONNECTIONS_KEY);
        return size != null ? size : 0;
    }
}
