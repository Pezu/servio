package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request from the dashboard when a cashier hits Cash/Card on a Collect button.
 * Carries the orders being settled and the chosen payment method; the backend
 * builds the actual fiscal receipt payload and would forward it to the ECR.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CashRegisterReceiptRequest {
    private List<UUID> orderIds;
    private String paymentMethod; // "CASH" or "CARD"
    private String operator;
    /** Cash register's uuid (deviceId). When omitted, the service falls back
     *  to the first ACTIVE device for the event. */
    private String cashRegisterDeviceId;
}
