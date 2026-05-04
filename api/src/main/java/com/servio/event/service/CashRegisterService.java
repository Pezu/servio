package com.servio.event.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.dto.CashRegisterReceiptResponse;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class CashRegisterService {

    private final OrderRepository orderRepository;
    private final OrderPointRepository orderPointRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /** requestId → context, so when an agent replies we know which event to push it to. */
    private record PendingReceiptContext(UUID eventId, String deviceId) {}
    private final ConcurrentHashMap<String, PendingReceiptContext> pendingReceipts = new ConcurrentHashMap<>();

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

        // Build the structured payload that gets pushed to the ECR agent.
        Map<String, Object> receiptPayload = buildReceiptPayload(orders, request, requestId);
        log.info("[CashRegister] Receipt payload (requestId={}):\n{}", requestId, pretty(receiptPayload));

        BigDecimal totalAmount = (BigDecimal) ((Map<String, Object>) receiptPayload.get("totals")).get("total");

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
        if (deviceOpt.isEmpty()) {
            log.warn("[CashRegister] No ECR agent registered for event {}; returning mock response.", eventId);
            return mockResponse(request, totalAmount);
        }

        String deviceId = deviceOpt.get().getId().toString();

        // True fire-and-forget. Publish to the agent and remember which event
        // to broadcast the eventual reply on, then return PENDING immediately.
        pendingReceipts.put(requestId, new PendingReceiptContext(eventId, deviceId));
        log.info("[CashRegister] Dispatching receipt to agent deviceId={} (requestId={})", deviceId, requestId);
        messagingTemplate.convertAndSendToUser(deviceId, "/queue/ecr/print", receiptPayload);
        log.info("[CashRegister] Published to /user/{}/queue/ecr/print (requestId={})\n{}",
                deviceId, requestId, pretty(receiptPayload));

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
     * Pushes the agent's reply to /topic/event/{eventId}/cash-register-reply so the
     * dashboard can react (toast / store fiscal number / mark order paid, etc.).
     */
    public void handleAgentReply(String requestId, CashRegisterReceiptResponse response) {
        PendingReceiptContext ctx = pendingReceipts.remove(requestId);
        if (ctx == null) {
            log.warn("[CashRegister] Agent replied for unknown/expired requestId={}; dropping.", requestId);
            return;
        }
        log.info("[CashRegister] Broadcasting agent reply (requestId={}, deviceId={}, eventId={}): {}",
                requestId, ctx.deviceId(), ctx.eventId(), response);
        messagingTemplate.convertAndSend("/topic/event/" + ctx.eventId() + "/cash-register-reply", response);
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

    private Map<String, Object> buildReceiptPayload(List<OrderEntity> orders, CashRegisterReceiptRequest request, String requestId) {
        OrderEntity first = orders.get(0);
        String orderPointName = orderPointRepository.findById(first.getOrderPointId())
                .map(op -> op.getName())
                .orElse("");

        List<Map<String, Object>> lines = new ArrayList<>();
        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalNet = BigDecimal.ZERO;
        BigDecimal totalVat = BigDecimal.ZERO;

        for (OrderEntity order : orders) {
            for (OrderItemEntity item : order.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                BigDecimal lineGross = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                BigDecimal vatRate = item.getVatRate() != null ? item.getVatRate() : BigDecimal.ZERO;
                BigDecimal lineNet;
                if (vatRate.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal divisor = BigDecimal.ONE.add(vatRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                    lineNet = lineGross.divide(divisor, 2, RoundingMode.HALF_UP);
                } else {
                    lineNet = lineGross;
                }
                BigDecimal lineVat = lineGross.subtract(lineNet);

                Map<String, Object> line = new java.util.LinkedHashMap<>();
                line.put("orderId", order.getId());
                line.put("orderNo", order.getOrderNo());
                line.put("itemId", item.getId());
                line.put("name", item.getName());
                line.put("quantity", item.getQuantity());
                line.put("unitPrice", item.getPrice());
                line.put("vatRate", vatRate);
                line.put("lineNet", lineNet);
                line.put("lineVat", lineVat);
                line.put("lineTotal", lineGross);
                lines.add(line);

                totalGross = totalGross.add(lineGross);
                totalNet = totalNet.add(lineNet);
                totalVat = totalVat.add(lineVat);
            }
        }

        List<Map<String, Object>> orderRefs = new ArrayList<>();
        for (OrderEntity o : orders) {
            Map<String, Object> ref = new java.util.LinkedHashMap<>();
            ref.put("orderId", o.getId());
            ref.put("orderNo", o.getOrderNo());
            ref.put("nickname", o.getNickname());
            ref.put("registrationId", o.getRegistrationId());
            ref.put("groupId", o.getGroupId());
            orderRefs.add(ref);
        }

        Map<String, Object> table = new java.util.LinkedHashMap<>();
        table.put("orderPointId", first.getOrderPointId());
        table.put("orderPointName", orderPointName);

        Map<String, Object> totals = new java.util.LinkedHashMap<>();
        totals.put("net", totalNet);
        totals.put("vat", totalVat);
        totals.put("total", totalGross);

        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("requestId", requestId);
        payload.put("receiptType", "PAY_LATER");
        payload.put("paymentMethod", request.getPaymentMethod());
        payload.put("operator", request.getOperator());
        payload.put("issuedAt", LocalDateTime.now());
        payload.put("eventId", first.getEventId());
        payload.put("table", table);
        payload.put("orders", orderRefs);
        payload.put("lines", lines);
        payload.put("totals", totals);
        return payload;
    }
}
