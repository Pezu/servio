package com.servio.event.dto.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemStatusChangedEvent {
    private UUID orderId;
    private Integer orderNo;
    private UUID itemId;
    private String itemName;
    private UUID eventId;
    private UUID orderPointId;
    private String previousStatus;
    private String newStatus;
}
