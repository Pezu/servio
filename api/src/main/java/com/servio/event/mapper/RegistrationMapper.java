package com.servio.event.mapper;

import com.servio.event.dto.Registration;
import com.servio.event.entity.RegistrationEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = EventMapper.class)
public interface RegistrationMapper {
    @Mapping(source = "orderPoint.id", target = "orderPointId")
    @Mapping(source = "orderPoint.name", target = "orderPointName")
    @Mapping(source = "orderPoint.payLater", target = "orderPointPayLater")
    @Mapping(source = "nickname", target = "nickname")
    @Mapping(source = "customer.id", target = "customerId")
    Registration toDto(RegistrationEntity entity);
}