package com.servio.event.dto;

import lombok.Data;

@Data
public class MarkPaidRequest {
    private String paymentMethod; // CASH or CARD
    private String paidBy;
}
