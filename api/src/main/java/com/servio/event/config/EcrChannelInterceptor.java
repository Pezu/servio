package com.servio.event.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Validates the single ECR bridge on STOMP CONNECT. The bridge sends X-Bridge-Key
 * as a native header; we compare it against the configured key and attach a fixed
 * principal so convertAndSendToUser(bridge.principal, ...) reaches that one session.
 *
 * Regular browser clients don't send X-Bridge-Key and are left untouched.
 */
@Slf4j
@Component
public class EcrChannelInterceptor implements ChannelInterceptor {

    private static final String KEY_HEADER = "X-Bridge-Key";

    private final String expectedKey;
    private final String principalName;

    public EcrChannelInterceptor(
            @Value("${bridge.api-key}") String expectedKey,
            @Value("${bridge.principal:bridge}") String principalName) {
        this.expectedKey = expectedKey;
        this.principalName = principalName;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String key = accessor.getFirstNativeHeader(KEY_HEADER);
        if (key == null) {
            // Not the bridge — leave the connection alone (browser clients, etc.).
            return message;
        }

        if (!key.equals(expectedKey)) {
            log.warn("[Bridge] Rejected CONNECT (bad X-Bridge-Key)");
            throw new MessagingException("Invalid bridge key");
        }

        accessor.setUser(new EcrPrincipal(principalName));
        log.info("[Bridge] Connected as principal={}", principalName);
        return message;
    }
}