package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventOrderPoint {
    private UUID id;
    private UUID eventId;
    private UUID orderPointId;
    private String orderPointName;
    private String sublocationName;
    private UUID userId;
    private String userName;
    private String userLogin;
    private BigDecimal prepaid;
    private String clientName;
    private String email;
    private String phone;
    private boolean credit;
    private BigDecimal creditValue;
}
