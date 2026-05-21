package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RegistrationApprovedEvent {
    private String type;
    private String registrationId;
    private String eventId;
    private String orderPointId;
}