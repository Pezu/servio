package com.servio.order.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.awspring.cloud.sqs.annotation.SqsListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Consumes events from the Event API related to registrations.
 * This enables decoupled communication between services.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RegistrationEventConsumer {

    private final ObjectMapper objectMapper;

    /**
     * Handles registration validation events.
     * When a registration is validated, orders can be processed.
     */
    @SqsListener("${sqs.queues.registration-validated}")
    public void handleRegistrationValidated(String message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> event = objectMapper.readValue(message, Map.class);
            log.info("Received registration validated event: {}", event);

            String registrationId = (String) event.get("registrationId");
            String eventId = (String) event.get("eventId");
            Boolean validated = (Boolean) event.get("validated");

            log.info("Registration {} validated: {} for event {}", registrationId, validated, eventId);

            // Future: Could trigger order processing or notifications
        } catch (Exception e) {
            log.error("Failed to process registration validated event: {}", e.getMessage(), e);
        }
    }
}
