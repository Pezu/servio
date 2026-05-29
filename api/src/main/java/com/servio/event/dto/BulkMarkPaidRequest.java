package com.servio.event.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Backoffice Collect modal: settles multiple orders in one shot and routes
 * a single fiscal receipt to the cash register identified by
 * {@code cashRegisterDeviceId}.
 */
@Data
public class BulkMarkPaidRequest {
    private List<UUID> orderIds;
    /** "CASH", "CARD", or "PROTOCOL". PROTOCOL skips the fiscal print. */
    private String paymentMethod;
    private String paidBy;
    /** Optional. When null, the listener falls back to the event's first CR. */
    private String cashRegisterDeviceId;
    /** Optional total tip (RON) — distributed proportionally across orderIds. */
    private BigDecimal tip;
}