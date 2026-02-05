package com.tapello.event.mapper;

import com.tapello.event.dto.MenuItem;
import com.tapello.event.entity.MenuItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.Named;

import java.util.UUID;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface MenuItemMapper {
    @Mapping(source = "location.id", target = "locationId")
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "entity", target = "clientId", qualifiedByName = "resolveClientId")
    @Mapping(target = "children", ignore = true)
    MenuItem toDto(MenuItemEntity entity);

    @Named("resolveClientId")
    default UUID resolveClientId(MenuItemEntity entity) {
        if (entity.getClient() != null) {
            return entity.getClient().getId();
        }
        if (entity.getLocation() != null && entity.getLocation().getClient() != null) {
            return entity.getLocation().getClient().getId();
        }
        return null;
    }
}