package com.servio.event.repository;

import com.servio.event.entity.FiscalReceiptEntity;
import com.servio.event.entity.FiscalReceiptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FiscalReceiptRepository extends JpaRepository<FiscalReceiptEntity, UUID> {

    Optional<FiscalReceiptEntity> findByRequestId(String requestId);

    /** Active (non-superseded) failed receipts for an event — feeds the mobile retry UI. */
    List<FiscalReceiptEntity> findByEventIdAndStatusAndSupersededFalse(UUID eventId, FiscalReceiptStatus status);

    /** Receipts stuck in a status since before the cutoff — used by the timeout sweeper. */
    List<FiscalReceiptEntity> findByStatusAndAttemptedAtBefore(FiscalReceiptStatus status, LocalDateTime cutoff);
}
