package com.servio.order.repository;

import com.servio.order.entity.OrderItemEntity;
import com.servio.order.entity.OrderItemStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItemEntity, UUID> {

    List<OrderItemEntity> findByOrderId(UUID orderId);

    @Query("SELECT i FROM OrderItemEntity i WHERE i.order.id = :orderId AND i.status = :status")
    List<OrderItemEntity> findByOrderIdAndStatus(@Param("orderId") UUID orderId, @Param("status") OrderItemStatus status);

    @Query("SELECT COUNT(i) FROM OrderItemEntity i WHERE i.order.id = :orderId AND i.status != :excludeStatus")
    long countByOrderIdAndStatusNot(@Param("orderId") UUID orderId, @Param("excludeStatus") OrderItemStatus excludeStatus);

    @Query("SELECT COUNT(i) FROM OrderItemEntity i WHERE i.order.id = :orderId AND i.status = :status")
    long countByOrderIdAndStatus(@Param("orderId") UUID orderId, @Param("status") OrderItemStatus status);

    @Modifying
    @Query("UPDATE OrderItemEntity i SET i.paid = true WHERE i.order.id = :orderId AND i.paid = false")
    int markItemsAsPaidByOrderId(@Param("orderId") UUID orderId);

    @Modifying
    @Query("UPDATE OrderItemEntity i SET i.paid = true WHERE i.order.registrationId = :registrationId AND i.paid = false")
    int markItemsAsPaidByRegistrationId(@Param("registrationId") UUID registrationId);

    @Modifying
    @Query("UPDATE OrderItemEntity i SET i.paid = true WHERE i.order.orderPointId = :orderPointId AND i.paid = false")
    int markItemsAsPaidByOrderPointId(@Param("orderPointId") UUID orderPointId);

    @Query("SELECT i FROM OrderItemEntity i WHERE i.order.registrationId = :registrationId AND i.paid = false")
    List<OrderItemEntity> findUnpaidByRegistrationId(@Param("registrationId") UUID registrationId);

    @Query("SELECT i FROM OrderItemEntity i WHERE i.order.orderPointId = :orderPointId AND i.paid = false")
    List<OrderItemEntity> findUnpaidByOrderPointId(@Param("orderPointId") UUID orderPointId);
}
