package com.tapello.event.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class WebSocketEventListener {

    private final Set<String> webSessions = ConcurrentHashMap.newKeySet();
    private final Set<String> orderSessions = ConcurrentHashMap.newKeySet();
    private final Map<String, String> sessionTypes = new ConcurrentHashMap<>();

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String destination = accessor.getDestination();

        if (sessionId != null && destination != null) {
            if (destination.startsWith("/topic/registration/")) {
                webSessions.add(sessionId);
                sessionTypes.put(sessionId, "web");
            } else if (destination.equals("/topic/orders")) {
                orderSessions.add(sessionId);
                sessionTypes.put(sessionId, "order");
            }
            logConnectionCounts();
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        if (sessionId != null) {
            String type = sessionTypes.remove(sessionId);
            if ("web".equals(type)) {
                webSessions.remove(sessionId);
            } else if ("order".equals(type)) {
                orderSessions.remove(sessionId);
            }
            logConnectionCounts();
        }
    }

    private void logConnectionCounts() {
        log.info("Open socket connections - web: {}, order: {}", webSessions.size(), orderSessions.size());
    }
}