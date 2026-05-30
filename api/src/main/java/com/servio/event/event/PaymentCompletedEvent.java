package com.servio.event.event;

import java.util.List;
import java.util.UUID;

/**
 * Published from PaymentService / OrderService after items have been marked as
 * paid. Carried via Spring's ApplicationEventPublisher and handled with
 * {@code @TransactionalEventListener(phase = AFTER_COMMIT)}, so listeners
 * (e.g. the cash-register print dispatcher) only fire if the payment
 * transaction commits.
 *
 * <ul>
 *   <li>{@code orderIds} — the orders whose items were just settled.</li>
 *   <li>{@code paymentMethod} — typically "CARD" for Netopia callbacks; "CASH",
 *       "CARD", or "PROTOCOL" for backoffice Collect actions.</li>
 *   <li>{@code cashRegisterDeviceId} — id of the ECR device chosen by the
 *       caller, or {@code null} to let the listener fall back to the event's
 *       first registered cash register.</li>
 *   <li>{@code operator} — who initiated the payment ({@code null} for
 *       gateway-driven callbacks; the listener falls back to "NETOPIA").</li>
 *   <li>{@code orderItemIds} — when non-null, restricts the fiscal receipt to
 *       exactly these (already split) order-item rows. Used by the partial-pay
 *       flow so a receipt covers only the units settled in this transaction,
 *       not every non-cancelled item on the orders. {@code null} for the
 *       full-pay path (receipt covers all non-cancelled items).</li>
 * </ul>
 */
public record PaymentCompletedEvent(
        List<UUID> orderIds,
        String paymentMethod,
        String cashRegisterDeviceId,
        String operator,
        List<UUID> orderItemIds,
        java.math.BigDecimal tip,
        UUID paymentRef) {

    /** Full-pay path: no item scoping — the receipt covers all non-cancelled items. */
    public PaymentCompletedEvent(List<UUID> orderIds, String paymentMethod,
                                 String cashRegisterDeviceId, String operator) {
        this(orderIds, paymentMethod, cashRegisterDeviceId, operator, null, null, null);
    }

    /** Scoped, no tip / no ref. */
    public PaymentCompletedEvent(List<UUID> orderIds, String paymentMethod,
                                 String cashRegisterDeviceId, String operator, List<UUID> orderItemIds) {
        this(orderIds, paymentMethod, cashRegisterDeviceId, operator, orderItemIds, null, null);
    }
}