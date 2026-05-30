package com.servio.event.service;

import com.servio.event.entity.FiscalReceiptStatus;
import com.servio.event.entity.OrderEntity;
import com.servio.event.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persists the fiscal-receipt lifecycle on orders, separate from the payment
 * flow. Lives in its own bean (not inline in {@link CashRegisterService})
 * because both call sites — {@code printReceipt} (AFTER_COMMIT listener) and
 * {@code handleAgentReply} (STOMP handler) — run outside any transaction, so a
 * self-invoked {@code @Transactional} method on the same bean wouldn't be
 * proxied. Here every method opens its own transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FiscalReceiptStatusService {

    private final OrderRepository orderRepository;

    /** Truncates to the order column width (fiscal_error VARCHAR(500)). */
    private static final int MAX_ERROR_LEN = 500;

    /**
     * Marks the given orders as awaiting a fiscal receipt and stamps the
     * requestId so the eventual agent reply can be correlated back.
     */
    @Transactional
    public void markPending(List<UUID> orderIds, String requestId) {
        if (orderIds == null) return;
        for (UUID id : orderIds) {
            orderRepository.findById(id).ifPresent(o -> {
                o.setFiscalReceiptStatus(FiscalReceiptStatus.PENDING);
                o.setFiscalRequestId(requestId);
                o.setFiscalError(null);
                o.setFiscalAttemptedAt(LocalDateTime.now());
                orderRepository.save(o);
            });
        }
    }

    /**
     * Applies the agent's reply to every order that carries this requestId.
     *
     * @return number of orders updated (0 = no order matched the requestId, e.g.
     *         a stale/duplicate reply or a mock dispatch that was never stamped).
     */
    @Transactional
    public int applyAgentResult(String requestId, boolean ok, String fiscalReceiptId, String errorMessage) {
        if (requestId == null || requestId.isBlank()) return 0;
        List<OrderEntity> orders = orderRepository.findByFiscalRequestId(requestId);
        for (OrderEntity o : orders) {
            if (ok) {
                o.setFiscalReceiptStatus(FiscalReceiptStatus.ISSUED);
                o.setFiscalReceiptId(fiscalReceiptId);
                o.setFiscalError(null);
            } else {
                o.setFiscalReceiptStatus(FiscalReceiptStatus.FAILED);
                o.setFiscalError(truncate(errorMessage));
            }
            orderRepository.save(o);
        }
        log.info("[Fiscal] requestId={} ok={} -> {} order(s) updated", requestId, ok, orders.size());
        return orders.size();
    }

    /** Mock/dev path: no real device, mark the receipt as issued immediately. */
    @Transactional
    public void markIssued(List<UUID> orderIds, String requestId, String fiscalReceiptId) {
        if (orderIds == null) return;
        for (UUID id : orderIds) {
            orderRepository.findById(id).ifPresent(o -> {
                o.setFiscalReceiptStatus(FiscalReceiptStatus.ISSUED);
                o.setFiscalRequestId(requestId);
                o.setFiscalReceiptId(fiscalReceiptId);
                o.setFiscalError(null);
                o.setFiscalAttemptedAt(LocalDateTime.now());
                orderRepository.save(o);
            });
        }
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= MAX_ERROR_LEN ? s : s.substring(0, MAX_ERROR_LEN);
    }
}
