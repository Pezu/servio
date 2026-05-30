package com.datecs.printerfpgate;

import com.datecs.printerfpgate.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Client STOMP WebSocket care se conecteaza la api-ul backend.
 *
 * Se autentifica prin {@code bridge.api-key} trimis:
 *   - ca header HTTP {@code X-Bridge-Key} la handshake-ul WebSocket
 *   - ca header STOMP la CONNECT frame
 *
 * Subscribe la {@code /user/queue/ecr/print} (user-destination, principal="bridge").
 * Trimite {@code AgentReplyPayload} pe {@code /app/ecr/result} dupa fiecare bon.
 *
 * Configurare (env vars sau application.properties):
 *   bridge.api-key             = cheia configurata si pe backend (BRIDGE_API_KEY)
 *   bridge.server-url          = wss://servioapp.ro/ws (default)
 */
@Slf4j
@Service
public class CloudSocketService {

    /** Numele headerului HTTP/STOMP pentru autentificare, asa cum il asteapta serverul. */
    private static final String HEADER_API_KEY = "X-Bridge-Key";

    /** Topic user-destination pe care serverul trimite request-urile de print catre bridge. */
    private static final String TOPIC_REQUEST  = "/user/queue/ecr/print";

    /** Destination STOMP catre care bridge-ul trimite raspunsul dupa print. */
    private static final String TOPIC_RESPONSE = "/app/ecr/result";

    private final PrintQueueManager printQueueManager;
    private final ObjectMapper      objectMapper;

    @Value("${bridge.server-url:wss://servioapp.ro/ws}")
    private String socketUrl;

    @Value("${bridge.reconnect-delay-seconds:10}")
    private long reconnectDelaySeconds;

    @Value("${bridge.api-key:}")
    private String apiKey;

    private volatile StompSession stompSession;

    public CloudSocketService(PrintQueueManager printQueueManager,
                               ObjectMapper objectMapper) {
        this.printQueueManager = printQueueManager;
        this.objectMapper      = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (apiKey == null || apiKey.isBlank()) {
            log.error("bridge.api-key nu este configurat (set env var BRIDGE_API_KEY). " +
                      "Conexiunea la backend va esua.");
        }
        connectAsync();
    }

    // ─── Procesare request primit de pe cloud ────────────────────────────────

    private void handleRequest(ServerReceiptPayload payload) {
        log.info("Request primit din cloud socket: requestId={} eventId={} cashRegister={}",
                payload.getRequestId(), payload.getEventId(), payload.getCashRegister());

        PrintReceiptRequest request = mapToInternalRequest(payload);

        printQueueManager.submit(request)
                .thenAccept(response -> sendReplyToCloud(payload.getRequestId(), payload.getEventId(), response))
                .exceptionally(ex -> {
                    log.error("Eroare procesare async requestId={}: {}",
                            payload.getRequestId(), ex.getMessage(), ex);
                    return null;
                });
    }

    /**
     * Mapeaza ServerReceiptPayload (DTO server) la PrintReceiptRequest (DTO intern).
     * Diferenta principala: ReceiptLine.quantity este Integer pe server, double intern.
     */
    private PrintReceiptRequest mapToInternalRequest(ServerReceiptPayload src) {
        PrintReceiptRequest req = new PrintReceiptRequest();
        req.setRequestId(src.getRequestId());
        req.setEventId(src.getEventId());
        req.setPaymentMethod(src.getPaymentMethod());
        req.setCashRegister(src.getCashRegister());

        if (src.getLines() != null) {
            List<PrintReceiptLine> lines = new ArrayList<>();
            for (ServerReceiptPayload.Line sl : src.getLines()) {
                PrintReceiptLine l = new PrintReceiptLine();
                l.setName(sl.getName());
                l.setQuantity(sl.getQuantity() != null ? sl.getQuantity().doubleValue() : 0.0);
                l.setUnitPrice(sl.getUnitPrice());
                l.setVat(sl.getVat());
                lines.add(l);
            }
            req.setLines(lines);
        }
        return req;
    }

    // ─── Trimitere raspuns pe cloud socket ───────────────────────────────────

    private void sendReplyToCloud(String requestId, String eventId, ReceiptResponse receipt) {
        if (stompSession == null || !stompSession.isConnected()) {
            log.warn("STOMP session inactiva – raspunsul NU a fost trimis pe cloud socket (requestId={}).", requestId);
            return;
        }
        try {
            // Construim AgentReplyPayload cu status "OK"/"ERROR" (nu "SUCCESS")
            AgentReplyPayload.Response resp = new AgentReplyPayload.Response(
                    "SUCCESS".equals(receipt.getStatus()) ? "OK" : "ERROR",
                    receipt.getReceiptNumber(),
                    receipt.getFiscalReceiptId(),
                    receipt.getCashRegisterSerial(),
                    receipt.getIssuedAt(),
                    receipt.getTotalAmount(),
                    receipt.getPaymentMethod(),
                    receipt.getErrorCode(),
                    receipt.getErrorMessage()
            );
            AgentReplyPayload reply = new AgentReplyPayload(requestId, eventId, resp);

            StompHeaders headers = new StompHeaders();
            headers.setDestination(TOPIC_RESPONSE);
            if (apiKey != null && !apiKey.isBlank()) {
                headers.add(HEADER_API_KEY, apiKey);
            }
            stompSession.send(headers, reply);
            log.info("AgentReplyPayload trimis pe {} (requestId={} status={})",
                    TOPIC_RESPONSE, requestId, resp.getStatus());
        } catch (Exception ex) {
            log.error("Eroare trimitere raspuns pe cloud socket (requestId={}): {}",
                    requestId, ex.getMessage(), ex);
        }
    }

    // ─── Conectare STOMP ─────────────────────────────────────────────────────

    private void connectAsync() {
        Thread t = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    log.info("Conectare la cloud socket: {} (apiKey={})",
                            socketUrl, apiKey != null && !apiKey.isBlank() ? "***" : "LIPSA");

                    WebSocketStompClient client = buildStompClient();

                    // Header HTTP la WebSocket handshake (upgrade request)
                    WebSocketHttpHeaders wsHeaders = new WebSocketHttpHeaders();
                    if (apiKey != null && !apiKey.isBlank()) {
                        wsHeaders.add(HEADER_API_KEY, apiKey);
                    }

                    // Header STOMP la CONNECT frame
                    StompHeaders connectHeaders = new StompHeaders();
                    if (apiKey != null && !apiKey.isBlank()) {
                        connectHeaders.add(HEADER_API_KEY, apiKey);
                    }

                    StompSession session = client
                            .connectAsync(socketUrl, wsHeaders, connectHeaders,
                                    new CloudStompSessionHandler())
                            .get(30, TimeUnit.SECONDS);
                    this.stompSession = session;
                    log.info("Conectat la cloud socket: {}", socketUrl);

                    while (session.isConnected()) {
                        Thread.sleep(5_000);
                    }
                    log.warn("Sesiunea STOMP s-a inchis. Reconectare in {}s...", reconnectDelaySeconds);

                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception ex) {
                    log.error("Eroare conectare cloud socket [{}]: {}. Reincerc in {}s...",
                            socketUrl, ex.getMessage(), reconnectDelaySeconds);
                }
                try { Thread.sleep(reconnectDelaySeconds * 1_000); }
                catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
            }
        }, "cloud-socket-connector");
        t.setDaemon(true);
        t.start();
    }

    /**
     * Construieste WebSocketStompClient cu SockJsClient.
     * Serverul foloseste .withSockJS() – fara SockJsClient conexiunea esueaza
     * deoarece serverul asteapta handshake SockJS (GET /ws/websocket/info),
     * nu un WebSocket pur.
     */
    private WebSocketStompClient buildStompClient() {
        SockJsClient sockJsClient = new SockJsClient(
                List.of(new WebSocketTransport(new StandardWebSocketClient()))
        );
        WebSocketStompClient client = new WebSocketStompClient(sockJsClient);
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(objectMapper);
        client.setMessageConverter(converter);
        return client;
    }

    // ─── Handlers STOMP ──────────────────────────────────────────────────────

    private class CloudStompSessionHandler extends StompSessionHandlerAdapter {
        @Override
        public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
            log.info("STOMP conectat. Subscribing la: {}", TOPIC_REQUEST);
            StompHeaders subHeaders = new StompHeaders();
            subHeaders.setDestination(TOPIC_REQUEST);
            if (apiKey != null && !apiKey.isBlank()) {
                subHeaders.add(HEADER_API_KEY, apiKey);
            }
            session.subscribe(subHeaders, new ReceiptPayloadFrameHandler());
        }

        @Override
        public void handleException(StompSession session, StompCommand command,
                                    StompHeaders headers, byte[] payload, Throwable ex) {
            log.error("Exceptie STOMP [{}]: {}", command, ex.getMessage(), ex);
        }

        @Override
        public void handleTransportError(StompSession session, Throwable ex) {
            log.error("Transport error STOMP: {}", ex.getMessage());
        }
    }

    private class ReceiptPayloadFrameHandler implements StompFrameHandler {
        @Override
        public Type getPayloadType(StompHeaders headers) {
            return ServerReceiptPayload.class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            try {
                handleRequest((ServerReceiptPayload) payload);
            } catch (Exception ex) {
                log.error("Eroare procesare frame STOMP: {}", ex.getMessage(), ex);
            }
        }
    }
}
