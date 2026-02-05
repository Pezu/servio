package com.tapello.event.repository;

import com.tapello.event.entity.PaymentTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentTypeRepository extends JpaRepository<PaymentTypeEntity, UUID> {

    Optional<PaymentTypeEntity> findByName(String name);

    boolean existsByName(String name);
}