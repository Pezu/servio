package com.servio.event.mapper;

import com.servio.event.dto.Order;
import com.servio.event.dto.OrderItem;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import java.util.List;

/**
 * Pure MapStruct mapper for Order entities.
 * This mapper only handles field mapping without database access.
 * Use OrderDtoEnricher service for additional data enrichment (order point names, event names, totals).
 */
@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderMapper {

    @org.mapstruct.Mapping(source = "nickname", target = "nickname")
    Order toDto(OrderEntity entity);

    List<Order> toDtoList(List<OrderEntity> entities);

    OrderItem toDto(OrderItemEntity entity);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "order", ignore = true)
    @org.mapstruct.Mapping(target = "status", ignore = true)
    OrderItemEntity toEntity(OrderItem dto);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "createdAt", ignore = true)
    @org.mapstruct.Mapping(target = "eventId", ignore = true)
    @org.mapstruct.Mapping(target = "orderNo", ignore = true)
    @org.mapstruct.Mapping(target = "status", ignore = true)
    @org.mapstruct.Mapping(target = "assignedUser", ignore = true)
    @org.mapstruct.Mapping(target = "items", ignore = true)
    OrderEntity toEntity(com.servio.event.dto.ReceiveOrderRequest request);
}