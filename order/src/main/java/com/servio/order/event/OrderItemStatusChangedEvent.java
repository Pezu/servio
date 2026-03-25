package com.servio.order.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Event published when an order item's status changes.
 * Consumed by: Event API (for WebSocket notifications)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemStatusChangedEvent {
    private UUID itemId;
    private UUID orderId;
    private UUID eventId;
    private UUID orderPointId;
    private Integer orderNo;
    private String itemName;
    private String previousStatus;
    private String newStatus;
    private LocalDateTime changedAt;
}
