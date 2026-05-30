package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request from the app to re-print a FAILED fiscal receipt. Carries only the
 * orders to re-fiscalize (and optionally the target device) — the payment
 * method/operator are read back from the orders, since this never re-charges.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetryReceiptRequest {
    private List<UUID> orderIds;
    /** ECR device uuid; when omitted, falls back to the event's first device. */
    private String cashRegisterDeviceId;
}
