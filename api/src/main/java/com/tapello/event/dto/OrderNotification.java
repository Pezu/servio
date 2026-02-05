package com.tapello.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderNotification {
    private UUID orderId;
    private Integer orderNo;
    private String type;
    private String message;
    private String itemName;
    private boolean orderClosed;
}