package com.tapello.event.mapper;

import com.tapello.event.dto.Order;
import com.tapello.event.dto.OrderItem;
import com.tapello.event.entity.OrderEntity;
import com.tapello.event.entity.OrderItemEntity;
import com.tapello.event.repository.EventRepository;
import com.tapello.event.repository.OrderPointRepository;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public abstract class OrderMapper {

    @Autowired
    protected OrderPointRepository orderPointRepository;

    @Autowired
    protected EventRepository eventRepository;

    public abstract Order toDto(OrderEntity entity);
    public abstract List<Order> toDtoList(List<OrderEntity> entities);
    public abstract OrderItem toDto(OrderItemEntity entity);

    @AfterMapping
    protected void setOrderPointName(OrderEntity entity, @MappingTarget Order dto) {
        if (entity.getOrderPointId() != null) {
            orderPointRepository.findById(entity.getOrderPointId())
                    .ifPresent(orderPoint -> dto.setOrderPointName(orderPoint.getName()));
        }
    }

    @AfterMapping
    protected void setEventName(OrderEntity entity, @MappingTarget Order dto) {
        if (entity.getEventId() != null) {
            eventRepository.findNameById(entity.getEventId())
                    .ifPresent(dto::setEventName);
        }
    }

    @AfterMapping
    protected void calculateTotalAmount(OrderEntity entity, @MappingTarget Order dto) {
        if (entity.getItems() != null && !entity.getItems().isEmpty()) {
            BigDecimal total = entity.getItems().stream()
                    .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            dto.setTotalAmount(total);
        } else {
            dto.setTotalAmount(BigDecimal.ZERO);
        }
    }
}