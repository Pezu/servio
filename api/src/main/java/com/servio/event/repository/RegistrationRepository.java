package com.servio.event.repository;

import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RegistrationRepository extends JpaRepository<RegistrationEntity, UUID> {
    List<RegistrationEntity> findByEventIdAndValidationStatus(UUID eventId, ValidationStatus validationStatus);

    List<RegistrationEntity> findByOrderPointIdAndValidationStatus(UUID orderPointId, ValidationStatus validationStatus);

    Optional<RegistrationEntity> findByEventIdAndOrderPointIdAndCustomerId(UUID eventId, UUID orderPointId, UUID customerId);
}