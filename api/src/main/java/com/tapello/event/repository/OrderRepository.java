package com.tapello.event.repository;

import com.tapello.event.entity.OrderEntity;
import com.tapello.event.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items ORDER BY o.orderNo DESC")
    List<OrderEntity> findAllWithItems();

    @Query(value = "SELECT o FROM OrderEntity o ORDER BY o.orderNo DESC",
           countQuery = "SELECT COUNT(o) FROM OrderEntity o")
    Page<OrderEntity> findAllOrders(Pageable pageable);

    @Query(value = "SELECT o FROM OrderEntity o WHERE o.createdAt BETWEEN :startDate AND :endDate ORDER BY o.orderNo DESC",
           countQuery = "SELECT COUNT(o) FROM OrderEntity o WHERE o.createdAt BETWEEN :startDate AND :endDate")
    Page<OrderEntity> findByCreatedAtBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate, Pageable pageable);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.eventId = :eventId AND o.status NOT IN :excludedStatuses ORDER BY o.orderNo ASC")
    List<OrderEntity> findByEventIdAndStatusNotIn(UUID eventId, List<OrderStatus> excludedStatuses);

    @Query("SELECT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<OrderEntity> findByIdWithItems(UUID id);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.registrationId = :registrationId ORDER BY o.orderNo DESC")
    List<OrderEntity> findByRegistrationIdOrderByOrderNoDesc(UUID registrationId);
}