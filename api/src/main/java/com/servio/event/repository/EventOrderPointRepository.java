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

    /** Event(s) that contain this order point. Usually one, but list-typed for safety. */
    @Query("SELECT DISTINCT eop.event.id FROM EventOrderPointEntity eop WHERE eop.orderPoint.id = :orderPointId")
    List<UUID> findEventIdsByOrderPointId(@Param("orderPointId") UUID orderPointId);

    /** Users directly assigned to a specific order point via event_order_point_users. */
    @Query("SELECT DISTINCT u.id FROM EventOrderPointEntity eop JOIN eop.users u " +
           "WHERE eop.orderPoint.id = :orderPointId")
    List<UUID> findUserIdsAssignedToOrderPoint(@Param("orderPointId") UUID orderPointId);

    /**
     * Order point ids the given username is assigned to within this event
     * (their service scope for the dashboard's serviceOrderPointId filter).
     */
    @Query("SELECT DISTINCT eop.orderPoint.id FROM EventOrderPointEntity eop " +
           "JOIN eop.users u " +
           "WHERE eop.event.id = :eventId AND u.username = :username")
    List<UUID> findOrderPointIdsByEventIdAndUserUsername(
            @Param("eventId") UUID eventId,
            @Param("username") String username);
}
