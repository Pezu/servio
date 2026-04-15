package com.servio.event.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.servio.event.dto.sqs.ValidationRequestedEvent;
import com.servio.event.entity.RegistrationEntity;
import io.awspring.cloud.sqs.operations.SqsTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationNotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final SqsTemplate sqsTemplate;
    private final ObjectMapper objectMapper;

    @Value("${sqs.queues.validation-requested}")
    private String validationRequestedQueue;

    public void notifyValidationRequested(RegistrationEntity registration) {
        UUID registrationId = registration.getId();
        UUID eventId = registration.getEvent().getId();
        UUID orderPointId = registration.getOrderPoint() != null ? registration.getOrderPoint().getId() : null;
        String orderPointName = registration.getOrderPoint() != null ? registration.getOrderPoint().getName() : null;

        if (orderPointId == null) {
            log.debug("No order point for registration {}, skipping validation request notification", registrationId);
            return;
        }

        ValidationRequestedEvent event = ValidationRequestedEvent.builder()
                .type("VALIDATION_REQUESTED")
                .registrationId(registrationId)
                .eventId(eventId)
                .nickname(registration.getNickname())
                .orderPointId(orderPointId)
                .orderPointName(orderPointName)
                .build();

        publishToSqs(validationRequestedQueue, event);

        String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/validation-requests";
        messagingTemplate.convertAndSend(orderPointDestination, event);

        String eventDestination = "/topic/event/" + eventId + "/validation-requests";
        messagingTemplate.convertAndSend(eventDestination, event);
    }

    public void notifyRegistrationApproved(RegistrationEntity registration) {
        UUID registrationId = registration.getId();
        UUID eventId = registration.getEvent().getId();
        UUID orderPointId = registration.getOrderPoint() != null ? registration.getOrderPoint().getId() : null;

        Map<String, Object> event = Map.of(
                "type", "REGISTRATION_APPROVED",
                "registrationId", registrationId.toString(),
                "eventId", eventId.toString(),
                "orderPointId", orderPointId != null ? orderPointId.toString() : ""
        );

        String eventDestination = "/topic/event/" + eventId + "/registrations";
        log.info("Sending registration approval to {}: {}", eventDestination, event);
        messagingTemplate.convertAndSend(eventDestination, event);

        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/registrations";
            log.info("Sending registration approval to {}: {}", orderPointDestination, event);
            messagingTemplate.convertAndSend(orderPointDestination, event);
        }

        Map<String, Object> directNotification = Map.of(
                "type", "APPROVED",
                "registrationId", registrationId.toString(),
                "message", "Your registration has been approved"
        );

        String registrationDestination = "/topic/registration/" + registrationId;
        log.info("Sending approval notification to {}: {}", registrationDestination, directNotification);
        messagingTemplate.convertAndSend(registrationDestination, directNotification);
    }

    private void publishToSqs(String queueName, Object event) {
        try {
            String message = objectMapper.writeValueAsString(event);
            log.info("Publishing to SQS queue {}: {}", queueName, message);
            sqsTemplate.send(queueName, message);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event for SQS queue {}: {}", queueName, e.getMessage());
            throw new RuntimeException("Failed to serialize event", e);
        }
    }
}
