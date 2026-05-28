package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Row in the mobile Approvals page — one entry per PROTOCOL-paid order.
 * {@code clientName} comes from the EventOrderPointEntity row in the event
 * configuration (Edit Event → Order Points → Client column), not from the
 * paying customer.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProtocolPaymentSummary {
    private UUID orderId;
    private Integer orderNo;
    private LocalDateTime paidAt;
    private String paidBy;
    private BigDecimal totalAmount;
    private UUID orderPointId;
    private String orderPointName;
    private String clientName;
}