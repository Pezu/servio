package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Result of GET /api/cash-registers/{id}/order-points.
 * <p>
 * {@code assigned} are the parent order points currently attached to this cash
 * register (within its event). {@code assignable} are the parent order points
 * at the event's location that are still available — i.e. not already
 * attached to ANY cash register for this event.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CashRegisterOrderPointsResponse {
    private List<OrderPointSummary> assigned;
    private List<OrderPointSummary> assignable;
}
