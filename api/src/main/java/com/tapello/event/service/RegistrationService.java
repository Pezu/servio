package com.tapello.event.service;

import com.tapello.event.dto.Registration;
import com.tapello.event.entity.EventEntity;
import com.tapello.event.entity.OrderPointEntity;
import com.tapello.event.entity.RegistrationEntity;
import com.tapello.event.entity.RegistrationEntity.ValidationStatus;
import com.tapello.event.mapper.RegistrationMapper;
import com.tapello.event.repository.EventRepository;
import com.tapello.event.repository.OrderPointRepository;
import com.tapello.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final RegistrationMapper registrationMapper;

    public Registration createRegistration(UUID eventId, UUID orderPointId) {
        // Validate that event exists
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + eventId));

        RegistrationEntity registrationEntity = new RegistrationEntity();
        registrationEntity.setEvent(event);

        // If orderPointId is provided, check if payLater is enabled
        if (orderPointId != null) {
            OrderPointEntity orderPoint = orderPointRepository.findById(orderPointId)
                    .orElseThrow(() -> new RuntimeException("Order point not found with id: " + orderPointId));
            registrationEntity.setOrderPoint(orderPoint);

            System.out.println("[Registration] OrderPoint: " + orderPoint.getName() + ", payLater: " + orderPoint.isPayLater());

            // If payLater is enabled, set validation status to PENDING
            if (orderPoint.isPayLater()) {
                System.out.println("[Registration] Setting status to PENDING");
                registrationEntity.setValidationStatus(ValidationStatus.PENDING);
            } else {
                System.out.println("[Registration] Setting status to APPROVED");
                registrationEntity.setValidationStatus(ValidationStatus.APPROVED);
            }
        } else {
            System.out.println("[Registration] No orderPointId provided, setting status to APPROVED");
            registrationEntity.setValidationStatus(ValidationStatus.APPROVED);
        }

        RegistrationEntity savedRegistration = registrationRepository.save(registrationEntity);
        return registrationMapper.toDto(savedRegistration);
    }

    public Registration getRegistration(UUID registrationId) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new RuntimeException("Registration not found with id: " + registrationId));
        return registrationMapper.toDto(registration);
    }

    public List<Registration> getPendingRegistrations(UUID eventId) {
        List<RegistrationEntity> pendingRegistrations = registrationRepository
                .findByEventIdAndValidationStatus(eventId, ValidationStatus.PENDING);
        return pendingRegistrations.stream()
                .map(registrationMapper::toDto)
                .toList();
    }

    public Registration approveRegistration(UUID registrationId, String approvedBy) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new RuntimeException("Registration not found with id: " + registrationId));

        registration.setValidationStatus(ValidationStatus.APPROVED);
        registration.setApprovedBy(approvedBy);
        registration.setApprovedAt(LocalDateTime.now());

        RegistrationEntity savedRegistration = registrationRepository.save(registration);
        return registrationMapper.toDto(savedRegistration);
    }
}