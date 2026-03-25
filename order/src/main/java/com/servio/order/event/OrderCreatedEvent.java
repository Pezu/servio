package com.servio.order.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Event published when a new order is created.
 * Consumed by: Event API (for WebSocket notifications), Analytics service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderCreatedEvent {
    private UUID orderId;
    private UUID registrationId;
    private UUID eventId;
    private UUID orderPointId;
    private Integer orderNo;
    private String status;
    private String nickname;
    private boolean needsPayment;
    private BigDecimal totalAmount;
    private List<OrderItemEvent> items;
    private LocalDateTime createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemEvent {
        private UUID itemId;
        private String name;
        private BigDecimal price;
        private Integer quantity;
        private String status;
    }
}
