package com.tapello.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateOrderPointRequest {
    private String name;
    private UUID locationId;
    private boolean payLater;
}