package com.servio.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

import java.util.UUID;

@FeignClient(name = "eventApiClient", url = "${services.event-api.url}")
public interface EventApiClient {

    @PostMapping("/api/internal/events/{eventId}/increment-order-no")
    Integer incrementAndGetOrderNo(@PathVariable("eventId") UUID eventId);

    @GetMapping("/api/internal/registrations/{registrationId}/event-id")
    UUID getEventIdByRegistrationId(@PathVariable("registrationId") UUID registrationId);

    @GetMapping("/api/internal/registrations/{registrationId}/nickname")
    String getNicknameByRegistrationId(@PathVariable("registrationId") UUID registrationId);
}
