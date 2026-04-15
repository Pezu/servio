package com.servio.gateway.websocket.dto.sqs;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatusChangedEvent {
    private UUID orderId;
    private Integer orderNo;
    private UUID registrationId;
    private UUID eventId;
    private UUID orderPointId;
    private String previousStatus;
    private String newStatus;
}
