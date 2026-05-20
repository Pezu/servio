package com.servio.event.repository;

import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import com.servio.event.entity.RegistrationOrderPointEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RegistrationOrderPointRepository extends JpaRepository<RegistrationOrderPointEntity, UUID> {

    Optional<RegistrationOrderPointEntity> findByRegistrationIdAndOrderPointId(UUID registrationId, UUID orderPointId);

    List<RegistrationOrderPointEntity> findByRegistrationEventIdAndValidationStatus(UUID eventId, ValidationStatus status);

    List<RegistrationOrderPointEntity> findByOrderPointIdAndValidationStatus(UUID orderPointId, ValidationStatus status);
}
