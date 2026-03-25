package com.servio.event.service;

import com.servio.event.dto.kafka.RegistrationApprovedEvent;
import com.servio.event.dto.kafka.ValidationRequestedEvent;
import com.servio.event.entity.RegistrationEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationNotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.validation-requested:validation.requested}")
    private String validationRequestedTopic;

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

        publishToKafka(validationRequestedTopic, event);

        String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/validation-requests";
        messagingTemplate.convertAndSend(orderPointDestination, event);

        String eventDestination = "/topic/event/" + eventId + "/validation-requests";
        messagingTemplate.convertAndSend(eventDestination, event);
    }

    public void notifyRegistrationApproved(RegistrationEntity registration) {
        UUID registrationId = registration.getId();
        UUID eventId = registration.getEvent().getId();
        UUID orderPointId = registration.getOrderPoint() != null ? registration.getOrderPoint().getId() : null;

        RegistrationApprovedEvent event = RegistrationApprovedEvent.builder()
                .type("REGISTRATION_APPROVED")
                .registrationId(registrationId)
                .eventId(eventId)
                .orderPointId(orderPointId)
                .build();

        String eventDestination = "/topic/event/" + eventId + "/registrations";
        log.info("Sending registration approval to {}: {}", eventDestination, event);
        messagingTemplate.convertAndSend(eventDestination, event);

        if (orderPointId != null) {
            String orderPointDestination = "/topic/orderpoint/" + orderPointId + "/registrations";
            log.info("Sending registration approval to {}: {}", orderPointDestination, event);
            messagingTemplate.convertAndSend(orderPointDestination, event);
        }

        RegistrationApprovedEvent directNotification = RegistrationApprovedEvent.builder()
                .type("APPROVED")
                .registrationId(registrationId)
                .message("Your registration has been approved")
                .build();

        String registrationDestination = "/topic/registration/" + registrationId;
        log.info("Sending approval notification to {}: {}", registrationDestination, directNotification);
        messagingTemplate.convertAndSend(registrationDestination, directNotification);
    }

    private void publishToKafka(String topic, Object event) {
        log.info("Publishing to Kafka topic {}: {}", topic, event);
        kafkaTemplate.send(topic, event);
    }
}
