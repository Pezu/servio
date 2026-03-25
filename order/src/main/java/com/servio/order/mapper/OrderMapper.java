package com.servio.order.mapper;

import com.servio.order.dto.OrderDto;
import com.servio.order.dto.OrderItemDto;
import com.servio.order.dto.ReceiveOrderRequest;
import com.servio.order.entity.OrderEntity;
import com.servio.order.entity.OrderItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderMapper {

    @Mapping(source = "nickname", target = "nickname")
    OrderDto toDto(OrderEntity entity);

    List<OrderDto> toDtoList(List<OrderEntity> entities);

    OrderItemDto toDto(OrderItemEntity entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "order", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "paid", ignore = true)
    OrderItemEntity toEntity(OrderItemDto dto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "eventId", ignore = true)
    @Mapping(target = "orderNo", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "assignedUser", ignore = true)
    @Mapping(target = "items", ignore = true)
    @Mapping(target = "needsPayment", ignore = true)
    OrderEntity toEntity(ReceiveOrderRequest request);
}
