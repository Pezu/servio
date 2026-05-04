package com.servio.event.service;

import com.servio.event.dto.sqs.ValidationRequestedEvent;
import com.servio.event.entity.RegistrationEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationNotificationService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ApplicationEventPublisher eventPublisher;

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

        log.info("Publishing validation requested event: registrationId={}, orderPointId={}",
                registrationId, orderPointId);
        eventPublisher.publishEvent(event);
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
    }
}
