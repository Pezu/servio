package com.servio.event.service;

import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.event.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * After a payment is committed (Netopia IPN, backoffice Collect, ...), dispatch
 * a fiscal receipt to the cash-register bridge agent for the event.
 *
 * Operator defaults to "NETOPIA" when the upstream didn't supply one — that
 * keeps the receipt audit trail self-explanatory for gateway-driven payments.
 * Backoffice Collect actions pass the cashier's username.
 *
 * Fire-and-forget: CashRegisterService publishes via STOMP and returns
 * immediately; the bridge replies later via /app/ecr/result.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CashRegisterPaymentListener {

    private static final String OPERATOR_NETOPIA = "NETOPIA";
    /** Internal payment marker — no fiscal receipt is printed for these. */
    private static final String PAYMENT_METHOD_PROTOCOL = "PROTOCOL";

    private final CashRegisterService cashRegisterService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentCompleted(PaymentCompletedEvent event) {
        if (event.orderIds() == null || event.orderIds().isEmpty()) {
            return;
        }
        if (PAYMENT_METHOD_PROTOCOL.equalsIgnoreCase(event.paymentMethod())) {
            log.info("[CashRegister] Skipping receipt — payment method is PROTOCOL (orders={})",
                    event.orderIds());
            return;
        }
        log.info("[CashRegister] Dispatching receipt for {} order(s) after payment ({}, deviceId={})",
                event.orderIds().size(), event.paymentMethod(), event.cashRegisterDeviceId());
        try {
            String operator = event.operator() != null ? event.operator() : OPERATOR_NETOPIA;
            var request = new CashRegisterReceiptRequest(
                    event.orderIds(),
                    event.paymentMethod(),
                    operator,
                    event.cashRegisterDeviceId()
            );
            cashRegisterService.printReceipt(request);
        } catch (Exception e) {
            // Fire-and-forget: never let a print failure break payment processing
            log.error("[CashRegister] Failed to dispatch receipt for orders {}: {}",
                    event.orderIds(), e.getMessage(), e);
        }
    }
}