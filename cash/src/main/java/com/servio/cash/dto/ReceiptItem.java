package com.servio.cash.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class ReceiptItem {
    private String name;
    private BigDecimal price;
    private BigDecimal quantity;
    private String vatGroup; // A, B, C, D, E, F, G, H
}
