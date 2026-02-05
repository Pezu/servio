package com.tapello.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReceiveOrderRequest {
    private UUID registrationId;
    private UUID orderPointId;
    private String note;
    private List<OrderItem> orderItems;
}