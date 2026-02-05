package com.tapello.event.repository;

import com.tapello.event.entity.OrderPointEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderPointRepository extends JpaRepository<OrderPointEntity, UUID> {
    Page<OrderPointEntity> findByLocationId(UUID locationId, Pageable pageable);
    List<OrderPointEntity> findByLocationId(UUID locationId);

    @Query("SELECT op FROM OrderPointEntity op WHERE op.location.id = :locationId OR op.location.parent.id = :locationId ORDER BY op.location.name, op.name")
    List<OrderPointEntity> findByLocationIdIncludingSublocations(@Param("locationId") UUID locationId);
}