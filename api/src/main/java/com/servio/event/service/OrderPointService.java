package com.servio.event.service;

import com.servio.event.dto.CreateOrderPointRequest;
import com.servio.event.dto.OrderPoint;
import com.servio.event.dto.UpdateOrderPointRequest;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderPointMapper;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.OrderPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderPointService {

    private final OrderPointRepository orderPointRepository;
    private final LocationRepository locationRepository;
    private final OrderPointMapper orderPointMapper;

    public OrderPoint createOrderPoint(UUID locationId, CreateOrderPointRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        OrderPointEntity orderPointEntity = new OrderPointEntity();
        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);

        OrderPointEntity savedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(savedOrderPoint);
    }

    public OrderPoint getOrderPointById(UUID id) {
        return orderPointRepository.findById(id)
                .map(orderPointMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));
    }

    public Page<OrderPoint> getAllOrderPoints(Pageable pageable) {
        return orderPointRepository.findAll(pageable)
                .map(orderPointMapper::toDto);
    }

    public Page<OrderPoint> getOrderPointsByLocationId(UUID locationId, Pageable pageable) {
        return orderPointRepository.findByLocationId(locationId, pageable)
                .map(orderPointMapper::toDto);
    }

    public OrderPoint updateOrderPoint(UUID id, UpdateOrderPointRequest request) {
        OrderPointEntity orderPointEntity = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", request.getLocationId()));

        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);

        OrderPointEntity updatedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(updatedOrderPoint);
    }
}