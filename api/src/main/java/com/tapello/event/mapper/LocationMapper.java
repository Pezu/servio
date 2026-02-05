package com.tapello.event.mapper;

import com.tapello.event.dto.Location;
import com.tapello.event.entity.LocationEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface LocationMapper {
    @Mapping(source = "client.id", target = "clientId")
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "parent.name", target = "parentName")
    Location toDto(LocationEntity entity);
}