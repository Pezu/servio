package com.servio.event.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class CreateEventRequest {
    private String name;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate endDate;

    private List<UUID> userIds;
    private List<UUID> waiterUserIds;
    private List<UUID> paymentTypeIds;
    private List<UUID> menuItemIds;
    private boolean requireValidation;
    private boolean paused;
}