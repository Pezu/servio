package com.servio.event.mapper;

import com.servio.event.dto.Registration;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationOrderPointEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = EventMapper.class)
public interface RegistrationMapper {
    @Mapping(source = "customer.id", target = "customerId")
    @Mapping(source = "user.id", target = "userId")
    @Mapping(target = "orderPointId", ignore = true)
    @Mapping(target = "orderPointName", ignore = true)
    @Mapping(target = "orderPointPayLater", ignore = true)
    @Mapping(target = "validationStatus", ignore = true)
    @Mapping(target = "approvedBy", ignore = true)
    @Mapping(target = "approvedAt", ignore = true)
    Registration toDto(RegistrationEntity entity);

    /**
     * Builds a Registration enriched with the per-OP junction context.
     */
    default Registration toDto(RegistrationEntity registration, RegistrationOrderPointEntity junction) {
        Registration dto = toDto(registration);
        if (junction != null) {
            dto.setOrderPointId(junction.getOrderPoint().getId());
            dto.setOrderPointName(junction.getOrderPoint().getName());
            dto.setOrderPointPayLater(junction.getOrderPoint().isPayLater());
            dto.setValidationStatus(junction.getValidationStatus().name());
            dto.setApprovedBy(junction.getApprovedBy());
            dto.setApprovedAt(junction.getApprovedAt());
        }
        return dto;
    }
}
