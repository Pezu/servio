package com.servio.order.repository;

import com.servio.order.entity.OrderEntity;
import com.servio.order.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {

    List<OrderEntity> findByRegistrationIdOrderByCreatedAtDesc(UUID registrationId);

    List<OrderEntity> findByOrderPointIdAndStatusInOrderByOrderNoAsc(UUID orderPointId, List<OrderStatus> statuses);

    List<OrderEntity> findByOrderPointIdOrderByCreatedAtDesc(UUID orderPointId);

    List<OrderEntity> findByEventIdOrderByCreatedAtDesc(UUID eventId);

    @Query("SELECT COALESCE(MAX(o.orderNo), 0) FROM OrderEntity o WHERE o.eventId = :eventId")
    Integer findMaxOrderNoByEventId(@Param("eventId") UUID eventId);

    @Query("SELECT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<OrderEntity> findByIdWithItems(@Param("id") UUID id);

    @Query("SELECT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.registrationId = :registrationId ORDER BY o.createdAt DESC")
    List<OrderEntity> findByRegistrationIdWithItems(@Param("registrationId") UUID registrationId);

    @Query("SELECT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.orderPointId = :orderPointId AND o.status IN :statuses ORDER BY o.orderNo ASC")
    List<OrderEntity> findByOrderPointIdAndStatusInWithItems(@Param("orderPointId") UUID orderPointId, @Param("statuses") List<OrderStatus> statuses);

    List<OrderEntity> findByRegistrationIdAndNeedsPaymentTrue(UUID registrationId);

    List<OrderEntity> findByOrderPointIdAndNeedsPaymentTrue(UUID orderPointId);
}
