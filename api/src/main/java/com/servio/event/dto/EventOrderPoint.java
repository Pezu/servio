package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
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
    private boolean payLater;
    private List<UUID> userIds = new ArrayList<>();
    private List<String> userNames = new ArrayList<>();
    private List<String> userLogins = new ArrayList<>();
    private UUID cashRegisterId;
    private String cashRegisterName;
    private BigDecimal prepaid;
    private String clientName;
    private String email;
    private String phone;
    private boolean credit;
    private BigDecimal creditValue;
    private boolean protocol;
}