package com.servio.event.dto;

import com.servio.event.entity.Status;
import lombok.Data;

import java.util.UUID;

@Data
public class UpdateClientRequest {
    private String name;
    private String phone;
    private String email;
    private Status status;
    private UUID clientTypeId;
}