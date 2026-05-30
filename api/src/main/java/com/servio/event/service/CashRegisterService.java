package com.servio.event.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.dto.CashRegisterReceiptResponse;
import com.servio.event.dto.ReceiptLine;
import com.servio.event.dto.ReceiptPayload;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.FiscalReceiptEntity;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class CashRegisterService {

    private final OrderRepository orderRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final FiscalReceiptStatusService fiscalReceiptStatusService;
    private final com.servio.event.repository.FiscalReceiptRepository fiscalReceiptRepository;
    private final org.springframework.messaging.simp.user.SimpUserRegistry simpUserRegistry;

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

        // Partial-pay flow scopes the receipt to specific (already split) item rows.
        java.util.Set<UUID> itemScope = request.getOrderItemIds() != null && !request.getOrderItemIds().isEmpty()
                ? new java.util.HashSet<>(request.getOrderItemIds())
                : null;

        ReceiptPayload receiptPayload = buildReceiptPayload(orders, request, requestId, eventId, deviceOpt.orElse(null), itemScope);
        log.info("[CashRegister] Receipt payload (requestId={}):\n{}", requestId, pretty(receiptPayload));

        // Tip settled in this transaction — printed as a "Tips" line (VAT 0%) and
        // added to the receipt total. null/<=0 means no tip line.
        BigDecimal tip = (request.getTip() != null && request.getTip().compareTo(BigDecimal.ZERO) > 0)
                ? request.getTip() : null;
        BigDecimal totalAmount = computeTotalAmount(orders, itemScope);
        if (tip != null) totalAmount = totalAmount.add(tip);

        if (deviceOpt.isEmpty()) {
            log.warn("[CashRegister] No ECR device configured for event {}; marking receipt FAILED (requestId={})",
                    eventId, requestId);
            String msg = "Nicio casa de marcat nu este configurata pentru acest eveniment.";
            fiscalReceiptStatusService.createFailed(requestId, eventId, request.getOrderIds(),
                    request.getOrderItemIds(), request.getPaymentMethod(), request.getCashRegisterDeviceId(),
                    totalAmount, tip, request.getPaymentRef(), msg);
            return CashRegisterReceiptResponse.builder()
                    .status("ERROR")
                    .errorCode("NO_ECR_DEVICE")
                    .errorMessage(msg)
                    .issuedAt(LocalDateTime.now())
                    .totalAmount(totalAmount)
                    .paymentMethod(request.getPaymentMethod())
                    .build();
        }

        // The bridge agent must have a live STOMP session, otherwise the dispatch
        // below is silently dropped and no reply ever comes — leaving the order
        // stuck PENDING. Detect it up front and fail fast so the retry button shows.
        if (simpUserRegistry.getUser(bridgePrincipal) == null) {
            log.warn("[CashRegister] Bridge agent '{}' is offline; marking receipt FAILED (requestId={})",
                    bridgePrincipal, requestId);
            String msg = "Agentul casei de marcat (bridge) nu este conectat. Bonul nu a fost trimis.";
            fiscalReceiptStatusService.createFailed(requestId, eventId, request.getOrderIds(),
                    request.getOrderItemIds(), request.getPaymentMethod(), request.getCashRegisterDeviceId(),
                    totalAmount, tip, request.getPaymentRef(), msg);
            return CashRegisterReceiptResponse.builder()
                    .status("ERROR")
                    .errorCode("BRIDGE_OFFLINE")
                    .errorMessage(msg)
                    .issuedAt(LocalDateTime.now())
                    .totalAmount(totalAmount)
                    .paymentMethod(request.getPaymentMethod())
                    .build();
        }

        // Record the receipt as awaiting the device reply BEFORE dispatch, keyed
        // by requestId (with its order + item scope) so the async reply correlates
        // back to exactly this receipt. The order stays paid; this only tracks the
        // fiscal lifecycle PENDING -> ISSUED/FAILED per dispatch.
        fiscalReceiptStatusService.createPending(requestId, eventId, request.getOrderIds(),
                request.getOrderItemIds(), request.getPaymentMethod(), request.getCashRegisterDeviceId(),
                totalAmount, tip, request.getPaymentRef());

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

        // Persist the fiscal outcome on the matching order(s): ISSUED on success,
        // FAILED (with the decoded device error) otherwise. This is what makes a
        // paid-but-not-fiscalized order visible and retryable instead of leaving
        // the result as a transient broadcast nobody may be listening to.
        boolean ok = response != null && "OK".equalsIgnoreCase(response.getStatus());
        String fiscalReceiptId = response != null ? response.getFiscalReceiptId() : null;
        String receiptNumber = response != null ? response.getReceiptNumber() : null;
        String errorMessage = response != null ? response.getErrorMessage() : null;
        try {
            fiscalReceiptStatusService.applyAgentResult(requestId, ok, fiscalReceiptId, receiptNumber, errorMessage);
        } catch (Exception ex) {
            log.error("[CashRegister] Failed to persist fiscal status (requestId={}): {}",
                    requestId, ex.getMessage(), ex);
        }

        log.info("[CashRegister] Broadcasting agent reply (requestId={}, eventId={}): {}",
                requestId, eventId, response);
        messagingTemplate.convertAndSend("/topic/event/" + eventId + "/cash-register-reply", response);
    }

    /**
     * Re-print a FAILED fiscal receipt, identified by its requestId.
     *
     * <p>Does <b>not</b> re-charge — the orders stay paid. It reprints exactly
     * the same scope (orders + item rows) as the failed receipt, so a partial
     * receipt re-fiscalizes only its own items, never the whole order. The old
     * receipt is superseded and a fresh one is dispatched with a new requestId.
     *
     * @param requestId the failed receipt to retry
     * @param deviceIdOverride optional ECR device; null reuses the original
     */
    public CashRegisterReceiptResponse retryReceipt(String requestId, String deviceIdOverride) {
        if (requestId == null || requestId.isBlank()) {
            return errorResponse("NO_REQUEST_ID", "No requestId supplied for retry");
        }
        FiscalReceiptEntity old = fiscalReceiptRepository.findByRequestId(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("FiscalReceipt", requestId));
        if (old.getOrderIds().isEmpty()) {
            return errorResponse("NO_ORDERS", "Receipt " + requestId + " has no orders to reprint");
        }
        String deviceId = deviceIdOverride != null ? deviceIdOverride : old.getCashRegisterDeviceId();
        // Empty item scope = full-pay receipt → pass null so printReceipt prints all items.
        List<UUID> itemScope = old.getOrderItemIds().isEmpty() ? null : new ArrayList<>(old.getOrderItemIds());
        log.info("[CashRegister] Retry receipt requestId={} ({} order(s), {} item(s), deviceId={})",
                requestId, old.getOrderIds().size(), old.getOrderItemIds().size(), deviceId);

        // Supersede the old failed receipt so it drops out of the FAILED list.
        fiscalReceiptStatusService.supersede(requestId);

        CashRegisterReceiptRequest req = new CashRegisterReceiptRequest(
                new ArrayList<>(old.getOrderIds()), old.getPaymentMethod(), null, deviceId, itemScope,
                old.getTip(), old.getPaymentRef());
        return printReceipt(req);
    }

    private CashRegisterReceiptResponse errorResponse(String code, String message) {
        return CashRegisterReceiptResponse.builder()
                .status("ERROR")
                .errorCode(code)
                .errorMessage(message)
                .issuedAt(LocalDateTime.now())
                .build();
    }

    /** Active (non-superseded) FAILED receipts for an event — feeds the mobile retry UI. */
    public List<com.servio.event.dto.FiscalReceiptDto> listFailedReceipts(UUID eventId) {
        return fiscalReceiptRepository
                .findByEventIdAndStatusAndSupersededFalse(eventId, com.servio.event.entity.FiscalReceiptStatus.FAILED)
                .stream()
                .map(r -> new com.servio.event.dto.FiscalReceiptDto(
                        r.getRequestId(), r.getEventId(), r.getStatus().name(), r.getPaymentMethod(),
                        r.getFiscalReceiptId(), r.getReceiptNumber(), r.getError(), r.getTotalAmount(), r.getTip(), r.getAttemptedAt(),
                        new ArrayList<>(r.getOrderIds()), new ArrayList<>(r.getOrderItemIds())))
                .toList();
    }

    private record LineKey(String name, BigDecimal unitPrice, BigDecimal vat) {}

    private ReceiptPayload buildReceiptPayload(List<OrderEntity> orders, CashRegisterReceiptRequest request, String requestId, UUID eventId, CashRegisterEntity device, java.util.Set<UUID> itemScope) {
        java.util.LinkedHashMap<LineKey, Integer> grouped = new java.util.LinkedHashMap<>();
        for (OrderEntity order : orders) {
            for (OrderItemEntity item : order.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                if (itemScope != null && !itemScope.contains(item.getId())) continue;
                BigDecimal vat = item.getVatRate() != null ? item.getVatRate() : BigDecimal.ZERO;
                // The fiscal printer only handles plain text — item names may carry
                // menu-admin HTML (e.g. <font size="1">0.7L</font>), so strip it here.
                LineKey key = new LineKey(stripHtml(item.getName()), item.getPrice(), vat);
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

        // Tip as a separate "Tips" line at VAT 0%, only when > 0.
        if (request.getTip() != null && request.getTip().compareTo(BigDecimal.ZERO) > 0) {
            lines.add(new ReceiptLine("Tips", 1, request.getTip(), BigDecimal.ZERO));
        }

        return new ReceiptPayload(
                requestId,
                eventId.toString(),
                request.getPaymentMethod(),
                device != null ? device.getIp() : null,
                lines
        );
    }

    /**
     * Reduce an item name to plain text for the fiscal printer: drop every HTML
     * tag, decode the common entities, and collapse whitespace. Tags become a
     * space so {@code Beer<br>0.7L} doesn't glue into {@code Beer0.7L}.
     */
    private static String stripHtml(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        String text = input.replaceAll("(?is)<[^>]*>", " ");
        text = text
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'");
        return text.replaceAll("\\s+", " ").trim();
    }

    private BigDecimal computeTotalAmount(List<OrderEntity> orders, java.util.Set<UUID> itemScope) {
        BigDecimal total = BigDecimal.ZERO;
        for (OrderEntity order : orders) {
            for (OrderItemEntity item : order.getItems()) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                if (itemScope != null && !itemScope.contains(item.getId())) continue;
                total = total.add(item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
            }
        }
        return total;
    }
}
