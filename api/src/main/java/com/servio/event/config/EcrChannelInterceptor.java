package com.servio.event.config;

import com.servio.event.repository.CashRegisterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * Validates ECR agents on STOMP CONNECT. The agent passes deviceId + token in
 * native headers; we look them up and attach an EcrPrincipal to the session so
 * convertAndSendToUser(deviceId, "/queue/ecr/print", ...) routes correctly.
 *
 * Regular browser clients are unaffected — they don't send the X-ECR-* headers,
 * so this interceptor leaves their session alone.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EcrChannelInterceptor implements ChannelInterceptor {

    private static final String DEVICE_HEADER = "X-ECR-Device-Id";
    private static final String TOKEN_HEADER = "X-ECR-Token";

    private final CashRegisterRepository cashRegisterRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String deviceId = accessor.getFirstNativeHeader(DEVICE_HEADER);
        String token = accessor.getFirstNativeHeader(TOKEN_HEADER);
        if (deviceId == null || token == null) {
            // Not an ECR agent — leave the connection alone.
            return message;
        }

        boolean valid;
        try {
            java.util.UUID id = java.util.UUID.fromString(deviceId);
            valid = cashRegisterRepository.findById(id)
                    .map(d -> token.equals(d.getSharedToken()))
                    .orElse(false);
        } catch (IllegalArgumentException e) {
            valid = false;
        }
        if (!valid) {
            log.warn("[ECR] Rejected agent CONNECT for deviceId={} (bad credentials)", deviceId);
            throw new MessagingException("Invalid ECR credentials");
        }

        accessor.setUser(new EcrPrincipal(deviceId));
        log.info("[ECR] Agent connected: deviceId={}", deviceId);
        return message;
    }
}
