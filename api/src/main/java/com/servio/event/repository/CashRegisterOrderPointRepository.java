package com.servio.event.repository;

import com.servio.event.entity.CashRegisterOrderPointEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CashRegisterOrderPointRepository extends JpaRepository<CashRegisterOrderPointEntity, UUID> {

    List<CashRegisterOrderPointEntity> findByCashRegisterId(UUID cashRegisterId);

    List<CashRegisterOrderPointEntity> findByEventId(UUID eventId);

    @Modifying
    void deleteByCashRegisterId(UUID cashRegisterId);
}
