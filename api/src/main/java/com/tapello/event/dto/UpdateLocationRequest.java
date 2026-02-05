package com.tapello.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateLocationRequest {
    private String name;
    private UUID clientId;
    private UUID parentId;
}