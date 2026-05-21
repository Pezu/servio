package com.servio.cash.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceiptResponse {
    private String status;
    private String receiptNumber;
    private String fiscalReceiptId;
    private String cashRegisterSerial;
    private LocalDateTime issuedAt;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private String errorCode;
    private String errorMessage;
}