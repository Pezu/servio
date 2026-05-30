package com.servio.event.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A fiscal-receipt dispatch as surfaced to the app — notably the FAILED ones the
 * mobile lists for retry. {@code requestId} identifies the receipt to retry;
 * {@code orderIds} maps it back to the order cards it belongs to.
 */
public record FiscalReceiptDto(
        String requestId,
        UUID eventId,
        String status,
        String paymentMethod,
        String fiscalReceiptId,
        String error,
        BigDecimal totalAmount,
        LocalDateTime attemptedAt,
        List<UUID> orderIds,
        List<UUID> orderItemIds) {
}
