package com.servio.event.service;

import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.event.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * After a payment is committed (e.g. Netopia IPN marks items paid), automatically
 * dispatch a fiscal receipt to the cash-register bridge agent for the event.
 *
 * Operator is set to "NETOPIA" so the receipt audit trail makes clear this was
 * triggered by the payment gateway, not a cashier at the POS.
 *
 * Fire-and-forget: CashRegisterService publishes via STOMP and returns
 * immediately; the bridge replies later via /app/ecr/result.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CashRegisterPaymentListener {

    private static final String OPERATOR_NETOPIA = "NETOPIA";

    private final CashRegisterService cashRegisterService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        if (event.orderIds() == null || event.orderIds().isEmpty()) {
            return;
        }
        log.info("[CashRegister] Dispatching receipt for {} order(s) after payment ({})",
                event.orderIds().size(), event.paymentMethod());
        try {
            var request = new CashRegisterReceiptRequest(
                    event.orderIds(),
                    event.paymentMethod(),
                    OPERATOR_NETOPIA,
                    null  // no specific deviceId — falls back to the event's bridge
            );
            cashRegisterService.printReceipt(request);
        } catch (Exception e) {
            // Fire-and-forget: never let a print failure break payment processing
            log.error("[CashRegister] Failed to dispatch receipt for orders {}: {}",
                    event.orderIds(), e.getMessage(), e);
        }
    }
}
