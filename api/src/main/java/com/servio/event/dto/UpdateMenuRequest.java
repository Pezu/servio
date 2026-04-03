package com.servio.event.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateMenuRequest {
    private String name;
    private UUID locationId;
}
