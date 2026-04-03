package com.servio.event.mapper;

import com.servio.event.dto.OrderPoint;
import com.servio.event.entity.OrderPointEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface OrderPointMapper {
    @Mapping(source = "location.id", target = "locationId")
    @Mapping(source = "menuItem.id", target = "menuItemId")
    @Mapping(source = "menuItem.name", target = "menuItemName")
    @Mapping(target = "menuIds", ignore = true)
    @Mapping(target = "menuNames", ignore = true)
    OrderPoint toDto(OrderPointEntity entity);
}