package com.tapello.event.dto;

public record StartPaymentRequest(
        Config config,
        Order order
) {
    public record Config(
            String emailTemplate,
            String notifyUrl,
            String redirectUrl,
            String language
    ) {}

    public record Order(
            String orderID,
            Double amount,
            String posSignature,
            String dateTime,
            String currency
    ) {}
}