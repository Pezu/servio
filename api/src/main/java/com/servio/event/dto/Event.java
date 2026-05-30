package com.servio.event.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Event {
    private UUID id;
    private String name;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate endDate;

    private UUID locationId;
    private String locationName;
    private String clientName;
    private String logoPath;
    private boolean requireValidation;
    private boolean paused;
    private boolean card;
    private List<UUID> userIds;
    private List<UUID> waiterUserIds;
    private List<UUID> paymentTypeIds;
    private List<UUID> menuItemIds;
}