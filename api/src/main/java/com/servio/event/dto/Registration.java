package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Registration {
    private UUID id;
    private Event event;
    private UUID orderPointId;
    private String orderPointName;
    private boolean orderPointPayLater;
    private String validationStatus;
    private String approvedBy;
    private LocalDateTime approvedAt;
    private LocalDateTime createdAt;
    private String nickname;
    private String firstName;
    private String lastName;
    private String phone;
}