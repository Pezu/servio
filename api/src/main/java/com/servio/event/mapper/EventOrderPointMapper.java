package com.servio.event.mapper;

import com.servio.event.dto.EventOrderPoint;
import com.servio.event.entity.EventOrderPointEntity;
import com.servio.event.entity.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.Named;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface EventOrderPointMapper {

    @Mapping(source = "event.id", target = "eventId")
    @Mapping(source = "orderPoint.id", target = "orderPointId")
    @Mapping(source = "orderPoint.name", target = "orderPointName")
    @Mapping(source = "orderPoint.location.name", target = "sublocationName")
    @Mapping(source = "orderPoint.payLater", target = "payLater")
    @Mapping(source = "users", target = "userIds", qualifiedByName = "userIds")
    @Mapping(source = "users", target = "userNames", qualifiedByName = "userNames")
    @Mapping(source = "users", target = "userLogins", qualifiedByName = "userLogins")
    @Mapping(target = "cashRegisterId", ignore = true)
    @Mapping(target = "cashRegisterName", ignore = true)
    EventOrderPoint toDto(EventOrderPointEntity entity);

    @Named("userIds")
    default List<UUID> userIds(Collection<UserEntity> users) {
        if (users == null) return List.of();
        return users.stream().map(UserEntity::getId).collect(Collectors.toList());
    }

    @Named("userNames")
    default List<String> userNames(Collection<UserEntity> users) {
        if (users == null) return List.of();
        return users.stream().map(UserEntity::getName).collect(Collectors.toList());
    }

    @Named("userLogins")
    default List<String> userLogins(Collection<UserEntity> users) {
        if (users == null) return List.of();
        return users.stream().map(UserEntity::getUsername).collect(Collectors.toList());
    }
}