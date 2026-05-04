package com.servio.event.service;

import com.servio.event.client.NetopiaClient;
import com.servio.event.config.NetopiaProperties;
import com.servio.event.dto.StartPaymentRequest;
import com.servio.event.dto.StartPaymentResponse;
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

    public StartPaymentResponse startPayment(String orderId, Double amount, String firstName, String lastName) {
        String currentIsoTime = ZonedDateTime.now().format(DateTimeFormatter.ISO_INSTANT);

        var config = new StartPaymentRequest.Config(
                netopiaProperties.emailTemplate(),
                netopiaProperties.notifyUrl(),
                netopiaProperties.redirectUrl(),
                netopiaProperties.language()
        );

        var billing = new StartPaymentRequest.Billing(
                "guest@servioapp.ro",
                "0700000000",
                firstName,
                lastName,
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

        log.info("Starting Netopia payment for orderId: {}, amount: {}, notifyUrl: {}", orderId, amount, netopiaProperties.notifyUrl());

        StartPaymentResponse response = netopiaClient.startPayment(
                netopiaProperties.apiKey(),
                request
        );

        log.info("Netopia payment started. Status: {}, Message: {}", response.status(), response.message());

        return response;
    }
}