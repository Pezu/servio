package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Mirrors what an ECR (electronic cash register / fiscal printer) echoes back
 * after printing a receipt: a receipt number, the device's fiscal-memory id,
 * its serial, a status, and an issuedAt timestamp. Populated from the bridge
 * agent's reply; errors carry an errorCode/errorMessage.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CashRegisterReceiptResponse {
    private String status;             // "OK" | "ERROR"
    private String receiptNumber;      // sequential, e.g. "00012345"
    private String fiscalReceiptId;    // unique fiscal-memory id
    private String cashRegisterSerial; // device serial
    private LocalDateTime issuedAt;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private String errorCode;
    private String errorMessage;
}
