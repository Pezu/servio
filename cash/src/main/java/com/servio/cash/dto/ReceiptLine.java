package com.servio.cash.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
public class ReceiptLine {
    private String name;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal vat;
}