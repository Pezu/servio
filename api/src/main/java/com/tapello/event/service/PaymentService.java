package com.tapello.event.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class PaymentService {

    @Value("${revolut.api.secret-key}")
    private String secretKey;

    @Value("${revolut.api.base-url}")
    private String baseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> createOrder(int amountInCents, String currency, String description) {
        String url = baseUrl + "/api/orders";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(secretKey);
        headers.set("Revolut-Api-Version", "2024-09-01");

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("amount", amountInCents);
        requestBody.put("currency", currency);
        requestBody.put("description", description);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
            log.info("Revolut order created: {}", response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("Failed to create Revolut order", e);
            throw new RuntimeException("Failed to create payment order: " + e.getMessage());
        }
    }
}