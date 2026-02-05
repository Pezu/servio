package com.tapello.event.mapper;

import com.tapello.event.dto.Registration;
import com.tapello.event.entity.RegistrationEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = EventMapper.class)
public interface RegistrationMapper {
    Registration toDto(RegistrationEntity entity);
}