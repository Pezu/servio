package com.tapello.event.repository;

import com.tapello.event.entity.ClientTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClientTypeRepository extends JpaRepository<ClientTypeEntity, UUID> {

    Optional<ClientTypeEntity> findByName(String name);

    boolean existsByName(String name);
}