package com.tapello.event.mapper;

import com.tapello.event.dto.User;
import com.tapello.event.entity.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface UserMapper {

    @Mapping(source = "client.id", target = "clientId")
    User toDto(UserEntity entity);
}