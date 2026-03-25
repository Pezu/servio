package com.servio.event.repository;

import com.servio.event.entity.EventOrderPointEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventOrderPointRepository extends JpaRepository<EventOrderPointEntity, UUID> {

    List<EventOrderPointEntity> findByEventId(UUID eventId);

    Optional<EventOrderPointEntity> findByEventIdAndOrderPointId(UUID eventId, UUID orderPointId);

    @Query("SELECT eop FROM EventOrderPointEntity eop " +
           "JOIN FETCH eop.orderPoint op " +
           "JOIN FETCH op.location loc " +
           "WHERE eop.event.id = :eventId " +
           "ORDER BY loc.name, op.name")
    List<EventOrderPointEntity> findByEventIdWithDetails(@Param("eventId") UUID eventId);

    void deleteByEventId(UUID eventId);
}
