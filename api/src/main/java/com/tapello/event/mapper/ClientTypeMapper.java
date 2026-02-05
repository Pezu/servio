package com.tapello.event.mapper;

import com.tapello.event.dto.ClientType;
import com.tapello.event.entity.ClientTypeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ClientTypeMapper {

    ClientType toDto(ClientTypeEntity entity);
}