package com.tapello.event.repository;

import com.tapello.event.entity.RegistrationEntity;
import com.tapello.event.entity.RegistrationEntity.ValidationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RegistrationRepository extends JpaRepository<RegistrationEntity, UUID> {
    List<RegistrationEntity> findByEventIdAndValidationStatus(UUID eventId, ValidationStatus validationStatus);
}