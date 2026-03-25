package com.servio.event.mapper;

import com.servio.event.dto.Role;
import com.servio.event.entity.RoleEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface RoleMapper {

    Role toDto(RoleEntity entity);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    RoleEntity toEntity(com.servio.event.dto.CreateRoleRequest request);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    void updateEntity(com.servio.event.dto.UpdateRoleRequest request, @org.mapstruct.MappingTarget RoleEntity entity);
}