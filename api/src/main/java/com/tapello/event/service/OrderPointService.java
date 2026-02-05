package com.tapello.event.service;

import com.tapello.event.dto.CreateOrderPointRequest;
import com.tapello.event.dto.OrderPoint;
import com.tapello.event.dto.UpdateOrderPointRequest;
import com.tapello.event.entity.LocationEntity;
import com.tapello.event.entity.OrderPointEntity;
import com.tapello.event.mapper.OrderPointMapper;
import com.tapello.event.repository.LocationRepository;
import com.tapello.event.repository.OrderPointRepository;
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
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + locationId));

        OrderPointEntity orderPointEntity = new OrderPointEntity();
        orderPointEntity.setName(request.getName());
        orderPointEntity.setLocation(location);

        OrderPointEntity savedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(savedOrderPoint);
    }

    public OrderPoint getOrderPointById(UUID id) {
        OrderPointEntity orderPointEntity = orderPointRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Order point not found with id: " + id));
        return orderPointMapper.toDto(orderPointEntity);
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
                .orElseThrow(() -> new RuntimeException("Order point not found with id: " + id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + request.getLocationId()));

        orderPointEntity.setName(request.getName());
        orderPointEntity.setLocation(location);

        OrderPointEntity updatedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(updatedOrderPoint);
    }
}