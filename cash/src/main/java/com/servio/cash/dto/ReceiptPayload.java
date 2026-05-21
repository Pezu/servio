package com.servio.cash.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class ReceiptPayload {
    private String requestId;
    private String eventId;
    private String paymentMethod;
    private String cashRegister;
    private List<ReceiptLine> lines;
}