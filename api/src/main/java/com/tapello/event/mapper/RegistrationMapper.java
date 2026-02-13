package com.tapello.event.mapper;

import com.tapello.event.dto.Registration;
import com.tapello.event.entity.RegistrationEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = EventMapper.class)
public interface RegistrationMapper {
    @Mapping(source = "orderPoint.id", target = "orderPointId")
    @Mapping(source = "orderPoint.name", target = "orderPointName")
    Registration toDto(RegistrationEntity entity);
}