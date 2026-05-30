package com.servio.event.entity;

/**
 * Lifecycle of an order's fiscal receipt, tracked independently of payment.
 *
 * <p>A {@code null} value means no receipt was ever attempted — e.g. PROTOCOL
 * payments (no fiscal receipt is printed) or events with no ECR device.
 *
 * <ul>
 *   <li>{@link #PENDING} — dispatched to the cash-register bridge, awaiting the
 *       device reply.</li>
 *   <li>{@link #ISSUED} — the device printed the fiscal receipt successfully.</li>
 *   <li>{@link #FAILED} — the device (or the bridge) returned an error; the order
 *       is paid but has no fiscal receipt and can be retried.</li>
 * </ul>
 */
public enum FiscalReceiptStatus {
    PENDING,
    ISSUED,
    FAILED
}
