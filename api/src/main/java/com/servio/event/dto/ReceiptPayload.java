package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ReceiptPayload {
    private String requestId;
    private String eventId;
    private String paymentMethod;
    private String cashRegister;
    private List<ReceiptLine> lines;
}