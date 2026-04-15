package com.servio.order.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PaymentStartRequest {
    private String returnUrl;
    private BigDecimal tip;
}
