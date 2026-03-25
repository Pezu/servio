package com.servio.event.dto.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationRequestedEvent {
    private String type;
    private UUID registrationId;
    private UUID eventId;
    private String nickname;
    private UUID orderPointId;
    private String orderPointName;
}
