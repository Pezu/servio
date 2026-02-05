package com.tapello.event.dto;

import com.tapello.event.entity.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Order {
    private UUID id;
    private Integer orderNo;
    private LocalDateTime createdAt;
    private UUID registrationId;
    private UUID eventId;
    private String eventName;
    private UUID orderPointId;
    private String orderPointName;
    private OrderStatus status;
    private String assignedUser;
    private String note;
    private List<OrderItem> items;
    private BigDecimal totalAmount;
}