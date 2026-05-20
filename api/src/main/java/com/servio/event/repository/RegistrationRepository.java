package com.servio.event.repository;

import com.servio.event.entity.RegistrationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RegistrationRepository extends JpaRepository<RegistrationEntity, UUID> {

    Optional<RegistrationEntity> findByEventIdAndCustomerId(UUID eventId, UUID customerId);

    Optional<RegistrationEntity> findByEventIdAndUserId(UUID eventId, UUID userId);

    Optional<RegistrationEntity> findByEventIdAndUserUsername(UUID eventId, String username);
}
