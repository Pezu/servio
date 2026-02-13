package com.tapello.event.repository;

import com.tapello.event.entity.EventEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventRepository extends JpaRepository<EventEntity, UUID> {
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
}