package com.servio.event.web;

import com.servio.event.service.EventService;
import com.servio.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Internal API endpoints for inter-service communication.
 * These endpoints are used by the Order microservice.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final EventService eventService;
    private final RegistrationService registrationService;

    /**
     * Atomically increments and returns the next order number for an event.
     */
    @PostMapping("/events/{eventId}/increment-order-no")
    public ResponseEntity<Integer> incrementAndGetOrderNo(@PathVariable UUID eventId) {
        log.debug("Incrementing order number for event: {}", eventId);
        Integer orderNo = eventService.incrementAndGetLastOrderNo(eventId);
        return ResponseEntity.ok(orderNo);
    }

    /**
     * Gets the event ID for a registration.
     */
    @GetMapping("/registrations/{registrationId}/event-id")
    public ResponseEntity<UUID> getEventIdByRegistrationId(@PathVariable UUID registrationId) {
        log.debug("Getting event ID for registration: {}", registrationId);
        UUID eventId = registrationService.getEventIdByRegistrationId(registrationId);
        return ResponseEntity.ok(eventId);
    }

    /**
     * Gets the nickname for a registration.
     */
    @GetMapping("/registrations/{registrationId}/nickname")
    public ResponseEntity<String> getNicknameByRegistrationId(@PathVariable UUID registrationId) {
        log.debug("Getting nickname for registration: {}", registrationId);
        String nickname = registrationService.getNicknameByRegistrationId(registrationId);
        return ResponseEntity.ok(nickname);
    }
}
