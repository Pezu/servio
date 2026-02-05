package com.tapello.event.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StartPaymentResponse(
        Integer status,
        String message,
        PaymentData payment
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PaymentData(
            String ntpID,
            String paymentURL,
            String token
    ) {}
}