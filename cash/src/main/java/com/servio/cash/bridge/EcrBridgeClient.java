package com.servio.cash.bridge;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servio.cash.dto.AgentReply;
import com.servio.cash.dto.ReceiptPayload;
import com.servio.cash.dto.ReceiptResponse;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class EcrBridgeClient {

    @Value("${bridge.server-url}")
    private String serverUrl;

    @Value("${bridge.api-key}")
    private String apiKey;

    @Value("${bridge.reply-delay-seconds:5}")
    private int replyDelaySeconds;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private StompSession session;

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private static String pretty(Object o) {
        try {
            return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(o);
        } catch (Exception e) {
            return String.valueOf(o);
        }
    }

    @PostConstruct
    public void connect() throws Exception {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("[Bridge] bridge.api-key must be set in application.yml");
            return;
        }

        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(MAPPER);

        WebSocketStompClient stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(converter);
        stompClient.setTaskScheduler(new ConcurrentTaskScheduler());

        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("X-Bridge-Key", apiKey);

        log.info("[Bridge] Connecting to {}", serverUrl);
        session = stompClient
                .connectAsync(serverUrl, new WebSocketHttpHeaders(), connectHeaders, new SessionHandler())
                .get();
        log.info("[Bridge] Connected, sessionId={}", session.getSessionId());

        session.subscribe("/user/queue/ecr/print", new ReceiptFrameHandler());
        log.info("[Bridge] Subscribed to /user/queue/ecr/print");
    }

    private class ReceiptFrameHandler extends StompSessionHandlerAdapter {
        @Override
        public Type getPayloadType(StompHeaders headers) {
            return ReceiptPayload.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            ReceiptPayload receipt = (ReceiptPayload) payload;
            log.info("[Bridge] Received receipt (requestId={}, eventId={}, ip={}):\n{}",
                    receipt.getRequestId(), receipt.getEventId(), receipt.getCashRegister(), pretty(receipt));
            scheduler.schedule(() -> sendReply(receipt), replyDelaySeconds, TimeUnit.SECONDS);
        }
    }

    private void sendReply(ReceiptPayload receipt) {
        ReceiptResponse response = new ReceiptResponse(
                "OK",
                "BRIDGE-" + System.currentTimeMillis(),
                "FIS-" + UUID.randomUUID(),
                "BRIDGE-MOCK-0001",
                LocalDateTime.now(),
                null,
                receipt.getPaymentMethod(),
                null,
                null
        );
        AgentReply reply = new AgentReply(receipt.getRequestId(), receipt.getEventId(), response);
        session.send("/app/ecr/result", reply);
        log.info("[Bridge] Sent reply for requestId={}", receipt.getRequestId());
    }

    private static class SessionHandler extends StompSessionHandlerAdapter {
        @Override
        public void handleException(StompSession session, org.springframework.messaging.simp.stomp.StompCommand command,
                                    StompHeaders headers, byte[] payload, Throwable exception) {
            log.error("[Bridge] STOMP exception", exception);
        }

        @Override
        public void handleTransportError(StompSession session, Throwable exception) {
            log.error("[Bridge] Transport error", exception);
        }
    }
}