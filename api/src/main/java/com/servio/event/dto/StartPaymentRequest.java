package com.servio.event.dto;

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
            String currency,
            Billing billing
    ) {}

    public record Billing(
            String email,
            String phone,
            String firstName,
            String lastName,
            String city,
            Integer country,
            String countryName,
            String state,
            String postalCode,
            String details
    ) {}
}