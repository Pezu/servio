package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Registration {
    private UUID id;
    private Event event;
    private LocalDateTime createdAt;
    private String nickname;
    private UUID customerId;
    private UUID userId;

    /**
     * Per-OP fields populated when the caller scoped the request to an order
     * point (scan, fetch with orderPointId, etc.). Null on registrations that
     * have no junction context — for example, waiter registrations.
     */
    private UUID orderPointId;
    private String orderPointName;
    private Boolean orderPointPayLater;
    private String validationStatus;
    private String approvedBy;
    private LocalDateTime approvedAt;
}
