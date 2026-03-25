package com.servio.event.mapper;

import com.servio.event.dto.ClientType;
import com.servio.event.entity.ClientTypeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ClientTypeMapper {

    ClientType toDto(ClientTypeEntity entity);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    ClientTypeEntity toEntity(com.servio.event.dto.CreateClientTypeRequest request);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    void updateEntity(com.servio.event.dto.UpdateClientTypeRequest request, @org.mapstruct.MappingTarget ClientTypeEntity entity);
}