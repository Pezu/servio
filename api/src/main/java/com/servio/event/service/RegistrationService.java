package com.servio.event.service;

import com.servio.event.dto.Registration;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.UnauthorizedAccessException;
import com.servio.event.mapper.RegistrationMapper;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final RegistrationMapper registrationMapper;
    private final RegistrationNotificationService registrationNotificationService;

    public Registration createRegistration(UUID eventId, UUID orderPointId, String nickname) {
        log.info("Creating registration with nickname: {}", nickname);

        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        RegistrationEntity registrationEntity = new RegistrationEntity();
        registrationEntity.setEvent(event);
        registrationEntity.setNickname(nickname);
        log.info("Set nickname on entity: {}", registrationEntity.getNickname());

        // Functional approach: determine validation status based on order point
        ValidationStatus status = Optional.ofNullable(orderPointId)
                .flatMap(orderPointRepository::findById)
                .map(orderPoint -> {
                    registrationEntity.setOrderPoint(orderPoint);
                    log.debug("OrderPoint: {}, payLater: {}", orderPoint.getName(), orderPoint.isPayLater());
                    return orderPoint.isPayLater() ? ValidationStatus.PENDING : ValidationStatus.APPROVED;
                })
                .orElse(ValidationStatus.APPROVED);

        log.debug("Setting registration status to {}", status);
        registrationEntity.setValidationStatus(status);

        RegistrationEntity savedRegistration = registrationRepository.save(registrationEntity);

        // Notify other clients at the same order point when a validation is requested
        if (status == ValidationStatus.PENDING) {
            registrationNotificationService.notifyValidationRequested(savedRegistration);
        }

        return registrationMapper.toDto(savedRegistration);
    }

    public Registration getRegistration(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(registrationMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    public List<Registration> getPendingRegistrations(UUID eventId) {
        return registrationRepository.findByEventIdAndValidationStatus(eventId, ValidationStatus.PENDING)
                .stream()
                .map(registrationMapper::toDto)
                .toList();
    }

    public Registration approveRegistration(UUID registrationId, String approvedBy) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        registration.setValidationStatus(ValidationStatus.APPROVED);
        registration.setApprovedBy(approvedBy);
        registration.setApprovedAt(LocalDateTime.now());

        RegistrationEntity savedRegistration = registrationRepository.save(registration);
        registrationNotificationService.notifyRegistrationApproved(savedRegistration);

        return registrationMapper.toDto(savedRegistration);
    }

    public List<Registration> getPendingRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationRepository.findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.PENDING)
                .stream()
                .filter(r -> !r.getId().equals(excludeRegistrationId))
                .map(registrationMapper::toDto)
                .toList();
    }

    public List<Registration> getApprovedRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationRepository.findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED)
                .stream()
                .filter(r -> !r.getId().equals(excludeRegistrationId))
                .map(registrationMapper::toDto)
                .toList();
    }

    public Registration approveRegistrationByClient(UUID registrationId, UUID approverRegistrationId) {
        RegistrationEntity approverRegistration = registrationRepository.findById(approverRegistrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", approverRegistrationId));

        if (approverRegistration.getValidationStatus() != ValidationStatus.APPROVED) {
            throw new UnauthorizedAccessException("Only approved registrations can approve others");
        }

        RegistrationEntity targetRegistration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        // Validate order point requirements
        UUID approverOrderPointId = Optional.ofNullable(approverRegistration.getOrderPoint())
                .map(OrderPointEntity::getId)
                .orElseThrow(() -> new BusinessException("Both registrations must have an order point"));

        UUID targetOrderPointId = Optional.ofNullable(targetRegistration.getOrderPoint())
                .map(OrderPointEntity::getId)
                .orElseThrow(() -> new BusinessException("Both registrations must have an order point"));

        if (!approverOrderPointId.equals(targetOrderPointId)) {
            throw new BusinessException("Can only approve registrations for the same order point");
        }

        targetRegistration.setValidationStatus(ValidationStatus.APPROVED);
        targetRegistration.setApprovedBy("client:" + approverRegistrationId);
        targetRegistration.setApprovedAt(LocalDateTime.now());

        RegistrationEntity savedRegistration = registrationRepository.save(targetRegistration);
        registrationNotificationService.notifyRegistrationApproved(savedRegistration);

        return registrationMapper.toDto(savedRegistration);
    }

    /**
     * Gets the event ID for a registration.
     * Used by the Order microservice.
     */
    public UUID getEventIdByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(r -> r.getEvent().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    /**
     * Gets the nickname for a registration.
     * Used by the Order microservice.
     */
    public String getNicknameByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(RegistrationEntity::getNickname)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }
}