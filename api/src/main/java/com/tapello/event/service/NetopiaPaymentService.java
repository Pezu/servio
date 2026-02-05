package com.tapello.event.service;

import com.tapello.event.client.NetopiaClient;
import com.tapello.event.config.NetopiaProperties;
import com.tapello.event.dto.StartPaymentRequest;
import com.tapello.event.dto.StartPaymentResponse;
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

    public StartPaymentResponse startPayment(String orderId, Double amount) {
        String currentIsoTime = ZonedDateTime.now().format(DateTimeFormatter.ISO_INSTANT);

        var config = new StartPaymentRequest.Config(
                netopiaProperties.emailTemplate(),
                netopiaProperties.notifyUrl(),
                netopiaProperties.redirectUrl(),
                netopiaProperties.language()
        );

        var order = new StartPaymentRequest.Order(
                orderId,
                amount,
                netopiaProperties.posSignature(),
                currentIsoTime,
                netopiaProperties.currency()
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