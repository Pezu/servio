package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketNotification {
    private String type;
    private UUID orderId;
    private Integer orderNo;
    private String itemName;
    private String message;
    private boolean orderClosed;

    // Routing information
    private UUID eventId;
    private UUID orderPointId;
    private UUID registrationId;

    // Validation request data
    private String nickname;
    private String orderPointName;
}