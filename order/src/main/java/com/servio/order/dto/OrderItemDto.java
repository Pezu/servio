package com.servio.order.dto;

import com.servio.order.entity.OrderItemStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemDto {
    private UUID id;
    private String name;
    private BigDecimal price;
    private Integer quantity;
    private OrderItemStatus status;
    private String note;
    private boolean paid;
}
