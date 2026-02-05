package com.tapello.event.mapper;

import com.tapello.event.dto.PaymentType;
import com.tapello.event.entity.PaymentTypeEntity;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface PaymentTypeMapper {

    PaymentType toDto(PaymentTypeEntity entity);
}