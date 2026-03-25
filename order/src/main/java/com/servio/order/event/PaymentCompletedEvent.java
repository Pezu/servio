package com.servio.order.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Event published when a payment is completed.
 * Consumed by: Event API (for WebSocket notifications)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentCompletedEvent {
    private String paymentReference;
    private PaymentType paymentType;
    private UUID eventId;
    private UUID orderPointId;
    private UUID registrationId;
    private UUID orderId;
    private BigDecimal amount;
    private int itemsMarkedPaid;
    private LocalDateTime completedAt;

    public enum PaymentType {
        ORDER,      // Single order payment
        GUEST,      // All orders for a registration
        ORDERPOINT  // All orders at an order point
    }
}
