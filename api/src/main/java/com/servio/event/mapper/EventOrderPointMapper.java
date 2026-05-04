package com.servio.event.mapper;

import com.servio.event.dto.EventOrderPoint;
import com.servio.event.entity.EventOrderPointEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface EventOrderPointMapper {

    @Mapping(source = "event.id", target = "eventId")
    @Mapping(source = "orderPoint.id", target = "orderPointId")
    @Mapping(source = "orderPoint.name", target = "orderPointName")
    @Mapping(source = "orderPoint.location.name", target = "sublocationName")
    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.name", target = "userName")
    @Mapping(source = "user.username", target = "userLogin")
    EventOrderPoint toDto(EventOrderPointEntity entity);
}
