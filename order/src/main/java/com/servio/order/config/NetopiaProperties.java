package com.servio.order.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "netopia")
public record NetopiaProperties(
        String apiKey,
        String posSignature,
        String baseUrl,
        String notifyUrl,
        String redirectUrl,
        String language,
        String currency,
        String emailTemplate
) {}
