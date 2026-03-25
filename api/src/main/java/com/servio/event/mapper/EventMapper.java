package com.servio.event.mapper;

import com.servio.event.dto.Event;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.MenuItemEntity;
import com.servio.event.entity.PaymentTypeEntity;
import com.servio.event.entity.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.Named;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface EventMapper {
    @Mapping(source = "location.id", target = "locationId")
    @Mapping(source = "location.name", target = "locationName")
    @Mapping(source = "location.client.name", target = "clientName")
    @Mapping(source = "users", target = "userIds", qualifiedByName = "usersToUserIds")
    @Mapping(source = "paymentTypes", target = "paymentTypeIds", qualifiedByName = "paymentTypesToIds")
    @Mapping(source = "menuItems", target = "menuItemIds", qualifiedByName = "menuItemsToIds")
    Event toDto(EventEntity entity);

    @Named("usersToUserIds")
    default List<UUID> usersToUserIds(Set<UserEntity> users) {
        if (users == null) {
            return Collections.emptyList();
        }
        return users.stream()
                .map(UserEntity::getId)
                .collect(Collectors.toList());
    }

    @Named("paymentTypesToIds")
    default List<UUID> paymentTypesToIds(Set<PaymentTypeEntity> paymentTypes) {
        if (paymentTypes == null) {
            return Collections.emptyList();
        }
        return paymentTypes.stream()
                .map(PaymentTypeEntity::getId)
                .collect(Collectors.toList());
    }

    @Named("menuItemsToIds")
    default List<UUID> menuItemsToIds(Set<MenuItemEntity> menuItems) {
        if (menuItems == null) {
            return Collections.emptyList();
        }
        return menuItems.stream()
                .map(MenuItemEntity::getId)
                .collect(Collectors.toList());
    }
}