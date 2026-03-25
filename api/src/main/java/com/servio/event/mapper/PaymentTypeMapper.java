package com.servio.event.mapper;

import com.servio.event.dto.PaymentType;
import com.servio.event.entity.PaymentTypeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface PaymentTypeMapper {

    PaymentType toDto(PaymentTypeEntity entity);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    PaymentTypeEntity toEntity(com.servio.event.dto.CreatePaymentTypeRequest request);

    @org.mapstruct.Mapping(target = "id", ignore = true)
    @org.mapstruct.Mapping(target = "active", ignore = true)
    void updateEntity(com.servio.event.dto.UpdatePaymentTypeRequest request, @org.mapstruct.MappingTarget PaymentTypeEntity entity);
}