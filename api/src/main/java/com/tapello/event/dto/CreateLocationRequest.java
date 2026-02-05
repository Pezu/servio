package com.tapello.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateLocationRequest {
    private String name;
    private UUID parentId;
}