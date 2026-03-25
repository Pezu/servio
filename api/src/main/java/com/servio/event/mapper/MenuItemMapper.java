package com.servio.event.mapper;

import com.servio.event.dto.MenuItem;
import com.servio.event.entity.AllergenEntity;
import com.servio.event.entity.MenuItemEntity;
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
public interface MenuItemMapper {
    @Mapping(source = "location.id", target = "locationId")
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(target = "children", ignore = true)
    @Mapping(source = "allergens", target = "allergenIds", qualifiedByName = "allergensToIds")
    @Mapping(source = "vatType.id", target = "vatTypeId")
    MenuItem toDto(MenuItemEntity entity);

    @Named("allergensToIds")
    default List<UUID> allergensToIds(Set<AllergenEntity> allergens) {
        if (allergens == null) {
            return Collections.emptyList();
        }
        return allergens.stream()
                .map(AllergenEntity::getId)
                .collect(Collectors.toList());
    }
}