package com.servio.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateOrderPointsBatchRequest {
    private int count;
    private boolean payLater;
    private UUID menuId;
}
