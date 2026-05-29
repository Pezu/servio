package com.servio.event.dto;

import com.servio.event.entity.OrderStatus;
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
    private UUID groupId;
    private OrderStatus status;
    private String assignedUser;
    private String note;
    private boolean needsPayment;
    private String nickname;
    private String paymentMethod;
    private String paidBy;
    private LocalDateTime paidAt;
    private BigDecimal tip;
    /** Distinct payment transactions that settled this order (> 1 = partial pay). */
    private Integer paymentCount;
    /** Per-payment breakdown (amount + method) backing the revenue report detail. */
    private List<Payment> payments;
    private List<OrderItem> items;
    private BigDecimal totalAmount;
    private BigDecimal netAmount;
    private BigDecimal vatAmount;
}