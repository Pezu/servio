package com.servio.cash.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ReceiptRequest {
    private String operatorCode;
    private String operatorPassword;
    private Integer tillNumber;
    private String uniqueSaleNumber; // UNP - Unique Number of the Sale
    private List<ReceiptItem> items;
    private PaymentType paymentType;
    private BigDecimal paymentAmount;

    public enum PaymentType {
        CASH,       // Payment type 0
        CARD,       // Payment type 1
        CREDIT,     // Payment type 2
        CHECK,      // Payment type 3
        COUPON      // Payment type 4
    }
}
