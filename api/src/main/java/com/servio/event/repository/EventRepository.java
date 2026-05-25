package com.servio.event.repository;

import com.servio.event.entity.EventEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventRepository extends JpaRepository<EventEntity, UUID> {

    /**
     * Atomically increments and returns the next order number for an event.
     * Uses database-level locking to prevent race conditions.
     */
    @Query(value = "SELECT increment_order_no(:eventId)", nativeQuery = true)
    Integer incrementAndGetLastOrderNo(@Param("eventId") UUID eventId);
    @EntityGraph(attributePaths = {"users"})
    Page<EventEntity> findByLocationId(UUID locationId, Pageable pageable);

    @Query("SELECT e.name FROM EventEntity e WHERE e.id = :id")
    Optional<String> findNameById(@Param("id") UUID id);

    @Override
    @EntityGraph(attributePaths = {"users"})
    Optional<EventEntity> findById(UUID id);

    @EntityGraph(attributePaths = {"users"})
    Page<EventEntity> findByUsersUsername(String username, Pageable pageable);

    @EntityGraph(attributePaths = {"users"})
    Page<EventEntity> findByUsersUsernameAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            String username, LocalDate startDate, LocalDate endDate, Pageable pageable);

    @EntityGraph(attributePaths = {"users"})
    @Query("SELECT e FROM EventEntity e WHERE e.location.client.id = :clientId")
    Page<EventEntity> findByClientId(@Param("clientId") UUID clientId, Pageable pageable);

    @EntityGraph(attributePaths = {"users"})
    Page<EventEntity> findByStartDateLessThanEqualAndEndDateGreaterThanEqual(
            LocalDate startDate, LocalDate endDate, Pageable pageable);

    @Query("SELECT DISTINCT e FROM EventEntity e JOIN EventOrderPointEntity eop ON eop.event = e WHERE eop.user.username = :username")
    Page<EventEntity> findByOrderPointUserUsername(@Param("username") String username, Pageable pageable);

    @Query("SELECT DISTINCT e FROM EventEntity e JOIN EventOrderPointEntity eop ON eop.event = e WHERE eop.user.username = :username AND e.startDate <= :now AND e.endDate >= :now")
    Page<EventEntity> findActiveByOrderPointUserUsername(@Param("username") String username, @Param("now") LocalDate now, Pageable pageable);

    /**
     * Active events where the user is assigned in any capacity — as a service
     * user on an EventOrderPoint, as a service user via event_users, or as a
     * waiter via event_waiters. Used by the mobile app's "My Active Events"
     * list so waiters see the events they belong to even when they aren't tied
     * to a specific order point.
     */
    @Query("SELECT e FROM EventEntity e " +
           "WHERE e.startDate <= :now AND e.endDate >= :now AND (" +
           "  EXISTS (SELECT 1 FROM EventOrderPointEntity eop WHERE eop.event = e AND eop.user.username = :username)" +
           "  OR EXISTS (SELECT 1 FROM EventEntity e2 JOIN e2.waiters w WHERE e2 = e AND w.username = :username)" +
           "  OR EXISTS (SELECT 1 FROM EventEntity e3 JOIN e3.users u WHERE e3 = e AND u.username = :username)" +
           ")")
    Page<EventEntity> findActiveAssignedToUsername(@Param("username") String username, @Param("now") LocalDate now, Pageable pageable);
}