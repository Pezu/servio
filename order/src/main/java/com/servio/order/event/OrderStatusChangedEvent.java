package com.servio.order.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Event published when an order's status changes.
 * Consumed by: Event API (for WebSocket notifications)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusChangedEvent {
    private UUID orderId;
    private UUID eventId;
    private UUID orderPointId;
    private UUID registrationId;
    private Integer orderNo;
    private String previousStatus;
    private String newStatus;
    private String assignedUser;
    private LocalDateTime changedAt;
}
