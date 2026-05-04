package com.servio.event.repository;

import com.servio.event.entity.CashRegisterEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CashRegisterRepository extends JpaRepository<CashRegisterEntity, UUID> {

    List<CashRegisterEntity> findByEventId(UUID eventId);

    @Modifying
    void deleteByEventId(UUID eventId);
}
