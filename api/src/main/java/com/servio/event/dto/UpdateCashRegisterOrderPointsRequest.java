package com.servio.event.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Body for PUT /api/cash-registers/{id}/order-points — replaces the full set. */
@Data
public class UpdateCashRegisterOrderPointsRequest {
    private List<UUID> orderPointIds;
}
