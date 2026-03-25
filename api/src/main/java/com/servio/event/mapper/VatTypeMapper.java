package com.servio.event.mapper;

import com.servio.event.dto.CreateVatTypeRequest;
import com.servio.event.dto.UpdateVatTypeRequest;
import com.servio.event.dto.VatType;
import com.servio.event.entity.VatTypeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface VatTypeMapper {

    VatType toDto(VatTypeEntity entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "active", ignore = true)
    VatTypeEntity toEntity(CreateVatTypeRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "active", ignore = true)
    void updateEntity(UpdateVatTypeRequest request, @MappingTarget VatTypeEntity entity);
}