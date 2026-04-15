package com.servio.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateOrderPointRequest {
    private String name;
    private boolean payLater;
    private UUID menuId;
}