package com.servio.event.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Mobile Payments → Pay → Partial: settle only a chosen subset (and quantity)
 * of an order point's unpaid items. The backend splits any item whose paid
 * quantity is less than its ordered quantity, marks the paid portion, and
 * routes a single fiscal receipt covering exactly the settled rows.
 */
@Data
public class PartialMarkPaidRequest {
    private List<Item> items;
    /** "CASH", "CARD", or "PROTOCOL". PROTOCOL skips the fiscal print. */
    private String paymentMethod;
    private String paidBy;
    /** Optional. When null, the listener falls back to the event's first CR. */
    private String cashRegisterDeviceId;
    /** Optional total tip (RON) — distributed across the settled orders. */
    private BigDecimal tip;

    @Data
    public static class Item {
        private UUID orderItemId;
        /** Units to settle now (1..item.quantity). */
        private int quantity;
    }
}