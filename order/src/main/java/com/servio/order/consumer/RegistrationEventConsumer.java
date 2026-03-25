package com.servio.order.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
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

    /**
     * Handles registration validation events.
     * When a registration is validated, orders can be processed.
     */
    @KafkaListener(topics = "${kafka.topics.registration-validated}", groupId = "order-service")
    public void handleRegistrationValidated(Map<String, Object> event) {
        log.info("Received registration validated event: {}", event);

        String registrationId = (String) event.get("registrationId");
        String eventId = (String) event.get("eventId");
        Boolean validated = (Boolean) event.get("validated");

        log.info("Registration {} validated: {} for event {}", registrationId, validated, eventId);

        // Future: Could trigger order processing or notifications
    }

    /**
     * Handles event order number updates for tracking.
     */
    @KafkaListener(topics = "${kafka.topics.event-order-number}", groupId = "order-service")
    public void handleEventOrderNumber(Map<String, Object> event) {
        log.info("Received event order number update: {}", event);

        String eventId = (String) event.get("eventId");
        Integer lastOrderNo = (Integer) event.get("lastOrderNo");

        log.info("Event {} order number updated to: {}", eventId, lastOrderNo);
    }
}
