package com.servio.event.event;

import java.util.List;
import java.util.UUID;

/**
 * Published from PaymentService after items have been marked as paid.
 * Carried via Spring's ApplicationEventPublisher and handled with
 * @TransactionalEventListener(phase = AFTER_COMMIT), so listeners (e.g. the
 * cash-register print dispatcher) only fire if the payment transaction commits.
 *
 * orderIds are the orders whose items were just settled. paymentMethod is
 * typically "CARD" for Netopia callbacks.
 */
public record PaymentCompletedEvent(List<UUID> orderIds, String paymentMethod) {}
