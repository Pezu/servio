package com.servio.event.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Fails fiscal receipts left PENDING for too long — the bridge died after
 * dispatch, or its reply was lost in transit. Without this they'd stay PENDING
 * forever: the order is paid, has no fiscal receipt, and shows no retry button
 * (the mobile UI only surfaces FAILED).
 *
 * The pre-dispatch presence check in {@link CashRegisterService} catches the
 * "bridge offline at send time" case; this sweeper catches everything after.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FiscalReceiptSweeper {

    private final FiscalReceiptStatusService fiscalReceiptStatusService;

    /** A receipt with no reply after this many seconds is considered failed. */
    @Value("${ecr.fiscal.pending-timeout-seconds:120}")
    private long pendingTimeoutSeconds;

    private static final String TIMEOUT_MSG =
            "Casa de marcat nu a raspuns in timp util (timeout). Bonul nu a fost confirmat.";

    @Scheduled(fixedDelayString = "${ecr.fiscal.sweep-interval-ms:30000}")
    public void sweepStalePending() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(pendingTimeoutSeconds);
        try {
            fiscalReceiptStatusService.failStalePending(cutoff, TIMEOUT_MSG);
        } catch (Exception ex) {
            log.error("[Fiscal] Sweeper failed: {}", ex.getMessage(), ex);
        }
    }
}
