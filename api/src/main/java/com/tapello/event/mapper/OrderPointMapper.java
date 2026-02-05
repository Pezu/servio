package com.tapello.event.mapper;

import com.tapello.event.dto.OrderPoint;
import com.tapello.event.entity.OrderPointEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderPointMapper {
    @Mapping(source = "location.id", target = "locationId")
    OrderPoint toDto(OrderPointEntity entity);
}