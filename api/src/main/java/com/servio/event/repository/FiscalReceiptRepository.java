package com.servio.event.repository;

import com.servio.event.entity.FiscalReceiptEntity;
import com.servio.event.entity.FiscalReceiptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
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

    /** Issued, active receipts for the given payment refs — per-payment report lookup. */
    @Query("SELECT r FROM FiscalReceiptEntity r WHERE r.status = com.servio.event.entity.FiscalReceiptStatus.ISSUED "
            + "AND r.superseded = false AND r.paymentRef IN :refs")
    List<FiscalReceiptEntity> findIssuedByPaymentRefs(@Param("refs") Collection<UUID> refs);

    /** Issued, active receipts covering any of the given orders — order-level report lookup. */
    @Query("SELECT r FROM FiscalReceiptEntity r JOIN r.orderIds oid WHERE oid IN :orderIds "
            + "AND r.status = com.servio.event.entity.FiscalReceiptStatus.ISSUED AND r.superseded = false")
    List<FiscalReceiptEntity> findIssuedByOrderIds(@Param("orderIds") Collection<UUID> orderIds);
}
