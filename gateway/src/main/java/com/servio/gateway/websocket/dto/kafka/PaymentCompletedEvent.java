package com.servio.gateway.websocket.dto.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentCompletedEvent {
    private UUID eventId;
    private UUID orderPointId;
    private Integer itemsMarkedPaid;
}
