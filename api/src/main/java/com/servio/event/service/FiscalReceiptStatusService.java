package com.servio.event.service;

import com.servio.event.entity.FiscalReceiptEntity;
import com.servio.event.entity.FiscalReceiptStatus;
import com.servio.event.repository.FiscalReceiptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persists the fiscal-receipt lifecycle, one row per dispatch (keyed by
 * requestId), independent of the payment flow.
 *
 * <p>Every write uses {@link Propagation#REQUIRES_NEW}. {@code printReceipt}
 * runs inside an {@code @TransactionalEventListener(AFTER_COMMIT)} callback,
 * where the payment transaction is already committed but its synchronization is
 * still bound to the thread — a plain {@code REQUIRED} method would silently
 * join that dead transaction and the write would be lost. REQUIRES_NEW forces a
 * fresh physical transaction that actually commits.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FiscalReceiptStatusService {

    private final FiscalReceiptRepository fiscalReceiptRepository;

    /** Truncates to the column width (error VARCHAR(500)). */
    private static final int MAX_ERROR_LEN = 500;

    /** Records a receipt awaiting the device reply (dispatched to the bridge). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createPending(String requestId, UUID eventId, List<UUID> orderIds, List<UUID> orderItemIds,
                              String paymentMethod, String cashRegisterDeviceId, BigDecimal totalAmount) {
        FiscalReceiptEntity r = newReceipt(requestId, eventId, orderIds, orderItemIds,
                paymentMethod, cashRegisterDeviceId, totalAmount);
        r.setStatus(FiscalReceiptStatus.PENDING);
        fiscalReceiptRepository.save(r);
    }

    /** Records a receipt that could not be dispatched at all (bridge offline, no device). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createFailed(String requestId, UUID eventId, List<UUID> orderIds, List<UUID> orderItemIds,
                             String paymentMethod, String cashRegisterDeviceId, BigDecimal totalAmount, String error) {
        FiscalReceiptEntity r = newReceipt(requestId, eventId, orderIds, orderItemIds,
                paymentMethod, cashRegisterDeviceId, totalAmount);
        r.setStatus(FiscalReceiptStatus.FAILED);
        r.setError(truncate(error));
        fiscalReceiptRepository.save(r);
    }

    private FiscalReceiptEntity newReceipt(String requestId, UUID eventId, List<UUID> orderIds, List<UUID> orderItemIds,
                                           String paymentMethod, String cashRegisterDeviceId, BigDecimal totalAmount) {
        FiscalReceiptEntity r = new FiscalReceiptEntity();
        r.setRequestId(requestId);
        r.setEventId(eventId);
        r.setPaymentMethod(paymentMethod);
        r.setCashRegisterDeviceId(cashRegisterDeviceId);
        r.setTotalAmount(totalAmount);
        r.setAttemptedAt(LocalDateTime.now());
        r.setOrderIds(orderIds != null ? new ArrayList<>(orderIds) : new ArrayList<>());
        r.setOrderItemIds(orderItemIds != null ? new ArrayList<>(orderItemIds) : new ArrayList<>());
        return r;
    }

    /**
     * Applies the agent's reply to the receipt carrying this requestId.
     *
     * @return true if a receipt matched and was updated; false for a stale or
     *         duplicate reply whose receipt no longer exists.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean applyAgentResult(String requestId, boolean ok, String fiscalReceiptId, String errorMessage) {
        if (requestId == null || requestId.isBlank()) return false;
        Optional<FiscalReceiptEntity> opt = fiscalReceiptRepository.findByRequestId(requestId);
        if (opt.isEmpty()) {
            log.warn("[Fiscal] Reply for unknown requestId={} (ignored)", requestId);
            return false;
        }
        FiscalReceiptEntity r = opt.get();
        if (ok) {
            r.setStatus(FiscalReceiptStatus.ISSUED);
            r.setFiscalReceiptId(fiscalReceiptId);
            r.setError(null);
        } else {
            r.setStatus(FiscalReceiptStatus.FAILED);
            r.setError(truncate(errorMessage));
        }
        fiscalReceiptRepository.save(r);
        log.info("[Fiscal] requestId={} ok={} -> {}", requestId, ok, r.getStatus());
        return true;
    }

    /** Marks the old receipt superseded when its retry creates a fresh dispatch. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void supersede(String requestId) {
        fiscalReceiptRepository.findByRequestId(requestId).ifPresent(r -> {
            r.setSuperseded(true);
            fiscalReceiptRepository.save(r);
        });
    }

    /**
     * Sweeper: flips PENDING receipts older than {@code cutoff} to FAILED — the
     * bridge died after dispatch, or its reply was lost. Safe to run early: the
     * receipt keeps its requestId, so a genuinely-late reply still corrects it.
     *
     * @return number of stale receipts failed
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int failStalePending(LocalDateTime cutoff, String error) {
        List<FiscalReceiptEntity> stale =
                fiscalReceiptRepository.findByStatusAndAttemptedAtBefore(FiscalReceiptStatus.PENDING, cutoff);
        for (FiscalReceiptEntity r : stale) {
            r.setStatus(FiscalReceiptStatus.FAILED);
            r.setError(truncate(error));
            fiscalReceiptRepository.save(r);
        }
        if (!stale.isEmpty()) {
            log.warn("[Fiscal] Swept {} stale PENDING receipt(s) to FAILED (no device reply before {})",
                    stale.size(), cutoff);
        }
        return stale.size();
    }

    private static String truncate(String s) {
        if (s == null) return null;
        return s.length() <= MAX_ERROR_LEN ? s : s.substring(0, MAX_ERROR_LEN);
    }
}
