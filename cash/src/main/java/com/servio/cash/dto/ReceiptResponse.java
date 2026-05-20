package com.servio.cash.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReceiptResponse {
    private boolean success;
    private String message;
    private String fiscalNumber;
    private String receiptNumber;
    private String rawResponse;
}
