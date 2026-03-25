package com.servio.order.service;

import com.servio.order.client.NetopiaClient;
import com.servio.order.config.NetopiaProperties;
import com.servio.order.dto.StartPaymentRequest;
import com.servio.order.dto.StartPaymentResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class NetopiaPaymentService {

    private final NetopiaClient netopiaClient;
    private final NetopiaProperties netopiaProperties;

    public StartPaymentResponse startPayment(String orderId, Double amount, String returnUrl) {
        String currentIsoTime = ZonedDateTime.now().format(DateTimeFormatter.ISO_INSTANT);

        // Use provided returnUrl or fall back to configured default
        String redirectUrl = (returnUrl != null && !returnUrl.isBlank())
                ? returnUrl
                : netopiaProperties.redirectUrl();

        var config = new StartPaymentRequest.Config(
                netopiaProperties.emailTemplate(),
                netopiaProperties.notifyUrl(),
                redirectUrl,
                netopiaProperties.language()
        );

        var billing = new StartPaymentRequest.Billing(
                "guest@servioapp.ro",
                "0700000000",
                "Guest",
                "Customer",
                "Bucharest",
                642,  // Romania ISO 3166-1 numeric
                "Romania",
                "Bucharest",
                "010000",
                "N/A"
        );

        var order = new StartPaymentRequest.Order(
                orderId,
                amount,
                netopiaProperties.posSignature(),
                currentIsoTime,
                netopiaProperties.currency(),
                billing
        );

        var request = new StartPaymentRequest(config, order);

        log.info("Starting Netopia payment for orderId: {}, amount: {}", orderId, amount);

        StartPaymentResponse response = netopiaClient.startPayment(
                netopiaProperties.apiKey(),
                request
        );

        log.info("Netopia payment started. Status: {}, Message: {}", response.status(), response.message());

        return response;
    }
}
