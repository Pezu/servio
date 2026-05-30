package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request from the app to re-print a FAILED fiscal receipt, identified by its
 * requestId. The orders, item scope and payment method are read back from the
 * stored receipt, so this never re-charges and reprints exactly the same scope.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RetryReceiptRequest {
    private String requestId;
    /** Optional ECR device override; null reuses the receipt's original device. */
    private String cashRegisterDeviceId;
}
