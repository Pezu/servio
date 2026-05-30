package com.servio.event.repository;

import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderStatus;
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

    @Query(value = "SELECT o FROM OrderEntity o WHERE o.eventId = :eventId ORDER BY o.orderNo DESC",
           countQuery = "SELECT COUNT(o) FROM OrderEntity o WHERE o.eventId = :eventId")
    Page<OrderEntity> findByEventIdPaged(@Param("eventId") UUID eventId, Pageable pageable);

    @Query(value = "SELECT o FROM OrderEntity o WHERE o.eventId = :eventId AND o.createdAt BETWEEN :startDate AND :endDate ORDER BY o.orderNo DESC",
           countQuery = "SELECT COUNT(o) FROM OrderEntity o WHERE o.eventId = :eventId AND o.createdAt BETWEEN :startDate AND :endDate")
    Page<OrderEntity> findByEventIdAndCreatedAtBetween(@Param("eventId") UUID eventId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate, Pageable pageable);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.eventId = :eventId AND o.status NOT IN :excludedStatuses ORDER BY o.orderNo ASC")
    List<OrderEntity> findByEventIdAndStatusNotIn(UUID eventId, List<OrderStatus> excludedStatuses);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.eventId = :eventId AND o.status = :status ORDER BY o.orderNo DESC")
    List<OrderEntity> findByEventIdAndStatus(@Param("eventId") UUID eventId, @Param("status") OrderStatus status);

    @Query("SELECT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<OrderEntity> findByIdWithItems(UUID id);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.registrationId = :registrationId ORDER BY o.orderNo DESC")
    List<OrderEntity> findByRegistrationIdOrderByOrderNoDesc(UUID registrationId);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.eventId = :eventId AND o.needsPayment = true ORDER BY o.orderNo ASC")
    List<OrderEntity> findByEventIdAndNeedsPaymentTrue(UUID eventId);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.orderPointId = :orderPointId AND o.status NOT IN :excludedStatuses ORDER BY o.orderNo ASC")
    List<OrderEntity> findByOrderPointIdAndStatusNotIn(UUID orderPointId, List<OrderStatus> excludedStatuses);

    @Query("SELECT o FROM OrderEntity o WHERE o.orderPointId = :orderPointId AND o.status = :status ORDER BY o.orderNo DESC")
    List<OrderEntity> findByOrderPointIdAndStatus(@Param("orderPointId") UUID orderPointId, @Param("status") OrderStatus status);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.orderPointId = :orderPointId ORDER BY o.orderNo ASC")
    List<OrderEntity> findByOrderPointIdWithItems(@Param("orderPointId") UUID orderPointId);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.orderPointId = :orderPointId AND o.nickname = :nickname ORDER BY o.orderNo ASC")
    List<OrderEntity> findByOrderPointIdAndNicknameWithItems(@Param("orderPointId") UUID orderPointId, @Param("nickname") String nickname);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.orderPointId = :orderPointId AND o.needsPayment = true ORDER BY o.orderNo ASC")
    List<OrderEntity> findByOrderPointIdAndNeedsPaymentTrue(@Param("orderPointId") UUID orderPointId);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items WHERE o.groupId = :groupId AND o.status NOT IN :excludedStatuses ORDER BY o.orderNo ASC")
    List<OrderEntity> findByGroupIdAndStatusNotIn(@Param("groupId") UUID groupId, @Param("excludedStatuses") List<OrderStatus> excludedStatuses);

    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items " +
           "WHERE o.eventId = :eventId AND o.paymentMethod = :paymentMethod " +
           "ORDER BY o.paidAt DESC")
    List<OrderEntity> findByEventIdAndPaymentMethod(@Param("eventId") UUID eventId, @Param("paymentMethod") String paymentMethod);

    /**
     * Scope variant of {@link #findByEventIdAndStatusNotIn} for the dashboard:
     * also requires the order's serviceOrderPointId to be in the supplied set,
     * so a logged-in user only sees orders served from OPs they're assigned to.
     */
    @Query("SELECT DISTINCT o FROM OrderEntity o LEFT JOIN FETCH o.items " +
           "WHERE o.eventId = :eventId " +
           "AND o.status NOT IN :excludedStatuses " +
           "AND o.serviceOrderPointId IN :serviceOrderPointIds " +
           "ORDER BY o.orderNo ASC")
    List<OrderEntity> findByEventIdAndStatusNotInAndServiceOrderPointIdIn(
            @Param("eventId") UUID eventId,
            @Param("excludedStatuses") List<OrderStatus> excludedStatuses,
            @Param("serviceOrderPointIds") List<UUID> serviceOrderPointIds);
}