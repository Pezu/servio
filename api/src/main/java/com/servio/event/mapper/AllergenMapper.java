package com.servio.event.mapper;

import com.servio.event.dto.Allergen;
import com.servio.event.entity.AllergenEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AllergenMapper {

    Allergen toDto(AllergenEntity entity);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "number", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    AllergenEntity toEntity(com.servio.event.dto.CreateAllergenRequest request);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "number", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    void updateEntity(com.servio.event.dto.UpdateAllergenRequest request, @org.mapstruct.MappingTarget AllergenEntity entity);
}
