package com.servio.event.service;

import com.servio.event.dto.CreateOrderPointRequest;
import com.servio.event.dto.OrderPoint;
import com.servio.event.dto.UpdateOrderPointRequest;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.MenuEntity;
import com.servio.event.entity.MenuItemEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderPointMapper;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.MenuItemRepository;
import com.servio.event.repository.MenuRepository;
import com.servio.event.repository.OrderPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderPointService {

    private final OrderPointRepository orderPointRepository;
    private final LocationRepository locationRepository;
    private final MenuItemRepository menuItemRepository;
    private final MenuRepository menuRepository;
    private final OrderPointMapper orderPointMapper;

    public OrderPoint createOrderPoint(UUID locationId, CreateOrderPointRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        OrderPointEntity orderPointEntity = new OrderPointEntity();
        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);
        resolveMenuItem(orderPointEntity, request.getMenuItemId(), locationId);

        OrderPointEntity savedOrderPoint = orderPointRepository.save(orderPointEntity);
        return enrichDto(savedOrderPoint);
    }

    public OrderPoint getOrderPointById(UUID id) {
        return orderPointRepository.findById(id)
                .map(this::enrichDto)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));
    }

    public Page<OrderPoint> getAllOrderPoints(Pageable pageable) {
        return orderPointRepository.findAll(pageable)
                .map(this::enrichDto);
    }

    public Page<OrderPoint> getOrderPointsByLocationId(UUID locationId, Pageable pageable) {
        return orderPointRepository.findByLocationId(locationId, pageable)
                .map(this::enrichDto);
    }

    public OrderPoint updateOrderPoint(UUID id, UpdateOrderPointRequest request) {
        OrderPointEntity orderPointEntity = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", request.getLocationId()));

        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);
        resolveMenuItem(orderPointEntity, request.getMenuItemId(), request.getLocationId());

        OrderPointEntity updatedOrderPoint = orderPointRepository.save(orderPointEntity);
        return enrichDto(updatedOrderPoint);
    }

    @Transactional
    public OrderPoint assignMenus(UUID orderPointId, List<UUID> menuIds) {
        OrderPointEntity orderPoint = orderPointRepository.findById(orderPointId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", orderPointId));

        Set<MenuEntity> menus = new HashSet<>(menuRepository.findAllById(menuIds));
        orderPoint.setMenus(menus);
        OrderPointEntity saved = orderPointRepository.save(orderPoint);
        return enrichDto(saved);
    }

    private OrderPoint enrichDto(OrderPointEntity entity) {
        OrderPoint dto = orderPointMapper.toDto(entity);
        Set<MenuEntity> menus = entity.getMenus();
        if (menus != null && !menus.isEmpty()) {
            dto.setMenuIds(menus.stream().map(MenuEntity::getId).collect(Collectors.toList()));
            dto.setMenuNames(menus.stream().map(MenuEntity::getName).collect(Collectors.toList()));
        } else {
            dto.setMenuIds(Collections.emptyList());
            dto.setMenuNames(Collections.emptyList());
        }
        return dto;
    }

    private void resolveMenuItem(OrderPointEntity orderPoint, UUID menuItemId, UUID locationId) {
        if (menuItemId == null) {
            orderPoint.setMenuItem(null);
            return;
        }
        MenuItemEntity menuItem = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new ResourceNotFoundException("MenuItem", menuItemId));

        UUID menuLocationId = menuItem.getLocation().getId();
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));
        UUID effectiveLocationId = location.getParent() != null ? location.getParent().getId() : locationId;

        if (!menuLocationId.equals(effectiveLocationId)) {
            throw new IllegalArgumentException("Menu item does not belong to the order point's location");
        }
        orderPoint.setMenuItem(menuItem);
    }
}
