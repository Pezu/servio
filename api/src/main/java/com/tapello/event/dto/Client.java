package com.tapello.event.dto;

import com.tapello.event.entity.Status;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Client {
    private UUID id;
    private String name;
    private String phone;
    private String email;
    private Status status;
    private String logoPath;
    private UUID clientTypeId;
    private String clientTypeName;
}