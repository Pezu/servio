package com.servio.event.repository;

import com.servio.event.entity.VatTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VatTypeRepository extends JpaRepository<VatTypeEntity, UUID> {

    Optional<VatTypeEntity> findByName(String name);

    boolean existsByName(String name);

    List<VatTypeEntity> findByActiveTrue();
}