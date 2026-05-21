package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class ReceiptLine {
    private String name;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal vat;
}