package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One payment transaction against an order — surfaced in the revenue report so
 * a multi-payment order can be broken down by amount and method.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Payment {
    private BigDecimal amount;
    private String paymentMethod;
    private String paidBy;
    private LocalDateTime paidAt;
    /** Fiscal receipt issued for this payment (filled by the revenue report). */
    private String fiscalReceiptId;
    private String receiptNumber;
}