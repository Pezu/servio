package com.tapello.event.mapper;

import com.tapello.event.dto.Role;
import com.tapello.event.entity.RoleEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface RoleMapper {

    Role toDto(RoleEntity entity);
}