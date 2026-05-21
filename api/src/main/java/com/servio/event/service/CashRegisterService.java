package com.servio.event.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.dto.CashRegisterReceiptResponse;
import com.servio.event.dto.ReceiptLine;
import com.servio.event.dto.ReceiptPayload;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class CashRegisterService {

    private final OrderRepository orderRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @org.springframework.beans.factory.annotation.Value("${bridge.principal:bridge}")
    private String bridgePrincipal;

    private static final ObjectMapper LOG_MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .enable(SerializationFeature.INDENT_OUTPUT);

    private static String pretty(Object o) {
        try {
            return LOG_MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            return String.valueOf(o);
        }
    }

    // In-memory monotonic counter used to fake a sequential receipt number when
    // no agent is connected yet (dev fallback). Resets on app restart — fine for now.
    private static final AtomicLong RECEIPT_SEQ = new AtomicLong(System.currentTimeMillis() % 100000);
    private static final String MOCK_DEVICE_SERIAL = "ECR-MOCK-0001";

    public CashRegisterReceiptResponse printReceipt(CashRegisterReceiptRequest request) {
        if (request.getOrderIds() == null || request.getOrderIds().isEmpty()) {
            return CashRegisterReceiptResponse.builder()
                    .status("ERROR")
                    .errorCode("NO_ORDERS")
                    .errorMessage("No orderIds supplied")
                    .issuedAt(LocalDateTime.now())
                    .build();
        }

        List<OrderEntity> orders = new ArrayList<>();
        for (UUID id : request.getOrderIds()) {
            orders.add(orderRepository.findByIdWithItems(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Order", id)));
        }

        // Stamp a unique requestId so the agent's eventual reply can be matched back.
        String requestId = UUID.randomUUID().toString();

        // Resolve which ECR device to print on. The frontend sends the chosen
        // device's id; if missing we fall back to the first registered one
        // for this event (preserves backwards compatibility).
        UUID eventId = orders.get(0).getEventId();
        Optional<CashRegisterEntity> deviceOpt = Optional.empty();
        if (request.getCashRegisterDeviceId() != null && !request.getCashRegisterDeviceId().isBlank()) {
            try {
                deviceOpt = cashRegisterRepository.findById(UUID.fromString(request.getCashRegisterDeviceId()));
            } catch (IllegalArgumentException e) {
                deviceOpt = Optional.empty();
            }
        }
        if (deviceOpt.isEmpty()) {
            deviceOpt = cashRegisterRepository.findByEventId(eventId).stream().findFirst();
        }

        ReceiptPayload receiptPayload = buildReceiptPayload(orders, request, requestId, eventId, deviceOpt.orElse(null));
        log.info("[CashRegister] Receipt payload (requestId={}):\n{}", requestId, pretty(receiptPayload));

        BigDecimal totalAmount = computeTotalAmount(orders);

        if (deviceOpt.isEmpty()) {
            log.warn("[CashRegister] No ECR agent registered for event {}; returning mock response.", eventId);
            return mockResponse(request, totalAmount);
        }

        // Fire-and-forget. Every print job goes to the single bridge principal —
        // the bridge picks the physical printer from the IP in the payload.
        // The bridge echoes eventId back so we don't need to track the request.
        log.info("[CashRegister] Dispatching receipt to bridge for IP={} (requestId={})",
                deviceOpt.get().getIp(), requestId);
        messagingTemplate.convertAndSendToUser(bridgePrincipal, "/queue/ecr/print", receiptPayload);
        log.info("[CashRegister] Published to /user/{}/queue/ecr/print (requestId={})\n{}",
                bridgePrincipal, requestId, pretty(receiptPayload));

        return CashRegisterReceiptResponse.builder()
                .status("PENDING")
                .receiptNumber(requestId)
                .issuedAt(LocalDateTime.now())
                .totalAmount(totalAmount)
                .paymentMethod(request.getPaymentMethod())
                .build();
    }

    /**
     * Called by the WebSocket message handler when the agent posts /app/ecr/result.
     * The agent echoes the original eventId back, so we broadcast directly to
     * /topic/event/{eventId}/cash-register-reply without any server-side state.
     */
    public void handleAgentReply(String requestId, String eventId, CashRegisterReceiptResponse response) {
        if (eventId == null) {
            log.warn("[CashRegister] Agent reply missing eventId (requestId={}); dropping.", requestId);
            return;
        }
        log.info("[CashRegister] Broadcasting agent reply (requestId={}, eventId={}): {}",
                requestId, eventId, response);
        messagingTemplate.convertAndSend("/topic/event/" + eventId + "/cash-register-reply", response);
    }

    private CashRegisterReceiptResponse mockResponse(CashRegisterReceiptRequest request, BigDecimal totalAmount) {
        long seq = RECEIPT_SEQ.incrementAndGet();
        String receiptNumber = String.format("%08d", seq);
        String fiscalReceiptId = "FIS-" + System.currentTimeMillis() + "-" + ThreadLocalRandom.current().nextInt(1000, 9999);
        CashRegisterReceiptResponse mock = CashRegisterReceiptResponse.builder()
                .status("OK")
                .receiptNumber(receiptNumber)
                .fiscalReceiptId(fiscalReceiptId)
                .cashRegisterSerial(MOCK_DEVICE_SERIAL)
                .issuedAt(LocalDateTime.now())
                .totalAmount(totalAmount)
                .paymentMethod(request.getPaymentMethod())
                .build();
        log.info("[CashRegister] Mock ECR response: {}", mock);
        return mock;
    }

    private record LineKey(String name, BigDecimal unitPrice, BigDecimal vat) {}

    private ReceiptPayload buildReceiptPayload(List<OrderEntity> orders, CashRegisterReceiptRequest request, String requestId, UUID eventId, CashRegisterEntity device) {
        java.util.LinkedHashMap<LineKey, Integer> grouped = new java.util.LinkedHashMap<>();
        for (OrderEntity order : orders) {
            for (OrderItemEntity item : order.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                BigDecimal vat = item.getVatRate() != null ? item.getVatRate() : BigDecimal.ZERO;
                LineKey key = new LineKey(item.getName(), item.getPrice(), vat);
                grouped.merge(key, item.getQuantity(), Integer::sum);
            }
        }

        List<ReceiptLine> lines = new ArrayList<>();
        for (Map.Entry<LineKey, Integer> e : grouped.entrySet()) {
            lines.add(new ReceiptLine(
                    e.getKey().name(),
                    e.getValue(),
                    e.getKey().unitPrice(),
                    e.getKey().vat()
            ));
        }

        return new ReceiptPayload(
                requestId,
                eventId.toString(),
                request.getPaymentMethod(),
                device != null ? device.getIp() : null,
                lines
        );
    }

    private BigDecimal computeTotalAmount(List<OrderEntity> orders) {
        BigDecimal total = BigDecimal.ZERO;
        for (OrderEntity order : orders) {
            for (OrderItemEntity item : order.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                total = total.add(item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
            }
        }
        return total;
    }
}
