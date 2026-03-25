package com.servio.event.mapper;

import com.servio.event.dto.Client;
import com.servio.event.entity.ClientEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ClientMapper {

    @Mapping(source = "clientType.id", target = "clientTypeId")
    @Mapping(source = "clientType.name", target = "clientTypeName")
    Client toDto(ClientEntity entity);
}