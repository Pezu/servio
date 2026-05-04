package com.servio.event.service;

import com.servio.event.dto.CreateOrderPointRequest;
import com.servio.event.dto.CreateOrderPointsBatchRequest;
import com.servio.event.dto.OrderPoint;
import com.servio.event.dto.UpdateOrderPointRequest;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.MenuEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderPointMapper;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.MenuRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.util.OrderPointNameComparator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class OrderPointService {

    private final OrderPointRepository orderPointRepository;
    private final LocationRepository locationRepository;
    private final MenuRepository menuRepository;
    private final OrderPointMapper orderPointMapper;

    public OrderPoint createOrderPoint(UUID locationId, CreateOrderPointRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        OrderPointEntity orderPointEntity = new OrderPointEntity();
        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);

        if (request.getMenuId() != null) {
            MenuEntity menu = menuRepository.findById(request.getMenuId())
                    .orElseThrow(() -> new ResourceNotFoundException("Menu", request.getMenuId()));
            orderPointEntity.setMenu(menu);
        }

        OrderPointEntity savedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(savedOrderPoint);
    }

    public OrderPoint getOrderPointById(UUID id) {
        return orderPointRepository.findById(id)
                .map(orderPointMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));
    }

    private static final Pattern GROUP_PREFIX = Pattern.compile("^([A-Za-z]+)(\\d+)\\.\\d+$");

    public List<OrderPoint> findGroupSiblings(UUID id) {
        OrderPointEntity ref = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));

        Matcher m = GROUP_PREFIX.matcher(ref.getName());
        if (!m.matches()) {
            return List.of(orderPointMapper.toDto(ref));
        }
        String prefix = m.group(1) + m.group(2) + ".";

        UUID locationId = ref.getLocation().getId();
        List<OrderPointEntity> all = orderPointRepository.findByLocationId(locationId);

        List<OrderPointEntity> siblings = new ArrayList<>();
        for (OrderPointEntity op : all) {
            if (op.getName() != null && op.getName().startsWith(prefix)) {
                siblings.add(op);
            }
        }
        siblings.sort(OrderPointNameComparator.by(OrderPointEntity::getName));

        List<OrderPoint> result = new ArrayList<>(siblings.size());
        for (OrderPointEntity op : siblings) {
            result.add(orderPointMapper.toDto(op));
        }
        return result;
    }

    public Page<OrderPoint> getAllOrderPoints(Pageable pageable) {
        return orderPointRepository.findAll(pageable)
                .map(orderPointMapper::toDto);
    }

    public Page<OrderPoint> getOrderPointsByLocationId(UUID locationId, Pageable pageable) {
        List<OrderPointEntity> all = orderPointRepository.findByLocationId(locationId);
        all.sort(OrderPointNameComparator.by(OrderPointEntity::getName));

        int total = all.size();
        int start = (int) pageable.getOffset();
        if (start >= total) {
            return new PageImpl<>(Collections.emptyList(), pageable, total);
        }
        int end = Math.min(start + pageable.getPageSize(), total);
        List<OrderPoint> content = new ArrayList<>(end - start);
        for (OrderPointEntity op : all.subList(start, end)) {
            content.add(orderPointMapper.toDto(op));
        }
        return new PageImpl<>(content, pageable, total);
    }

    public List<OrderPoint> createOrderPointsBatch(UUID locationId, CreateOrderPointsBatchRequest request) {
        if (request.getCount() < 1) {
            throw new IllegalArgumentException("count must be at least 1");
        }

        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        MenuEntity menu = null;
        if (request.getMenuId() != null) {
            menu = menuRepository.findById(request.getMenuId())
                    .orElseThrow(() -> new ResourceNotFoundException("Menu", request.getMenuId()));
        }

        List<OrderPointEntity> existing = orderPointRepository.findByLocationId(locationId);
        List<String> names = generateNames(existing, request.getCount(), request.isPayLater());

        List<OrderPointEntity> toCreate = new ArrayList<>(names.size());
        for (String name : names) {
            OrderPointEntity entity = new OrderPointEntity();
            entity.setName(name);
            entity.setPayLater(request.isPayLater());
            entity.setLocation(location);
            entity.setMenu(menu);
            toCreate.add(entity);
        }

        List<OrderPointEntity> saved = orderPointRepository.saveAll(toCreate);
        List<OrderPoint> result = new ArrayList<>(saved.size());
        for (OrderPointEntity entity : saved) {
            result.add(orderPointMapper.toDto(entity));
        }
        return result;
    }

    private static final Pattern PAY_LATER_NAME = Pattern.compile("^M(\\d+)\\.(\\d+)$");
    private static final Pattern NON_PAY_LATER_NAME = Pattern.compile("^B(\\d+)$");

    private List<String> generateNames(List<OrderPointEntity> existing, int count, boolean payLater) {
        List<String> names = new ArrayList<>(count);
        if (payLater) {
            int maxGroup = 0;
            for (OrderPointEntity op : existing) {
                Matcher m = PAY_LATER_NAME.matcher(op.getName());
                if (m.matches()) {
                    maxGroup = Math.max(maxGroup, Integer.parseInt(m.group(1)));
                }
            }
            for (int i = 1; i <= count; i++) {
                names.add("M" + (maxGroup + i) + ".1");
            }
        } else {
            int maxNum = 0;
            for (OrderPointEntity op : existing) {
                Matcher m = NON_PAY_LATER_NAME.matcher(op.getName());
                if (m.matches()) {
                    maxNum = Math.max(maxNum, Integer.parseInt(m.group(1)));
                }
            }
            for (int i = 1; i <= count; i++) {
                names.add("B" + (maxNum + i));
            }
        }
        return names;
    }

    public void deleteOrderPoint(UUID id) {
        OrderPointEntity entity = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));
        orderPointRepository.delete(entity);
    }

    private static final Pattern SPLIT_NAME_PATTERN = Pattern.compile("^([A-Za-z]+\\d+)\\.(\\d+)$");

    public OrderPoint splitOrderPoint(UUID id) {
        OrderPointEntity source = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));

        if (!source.isPayLater()) {
            throw new IllegalArgumentException("Only pay-later order points can be split");
        }

        Matcher m = SPLIT_NAME_PATTERN.matcher(source.getName());
        if (!m.matches()) {
            throw new IllegalArgumentException("Order point name does not match the M{n}.{m} pattern: " + source.getName());
        }
        String prefix = m.group(1) + ".";

        UUID locationId = source.getLocation().getId();
        Pattern siblingPattern = Pattern.compile("^" + Pattern.quote(prefix) + "(\\d+)$");
        int maxSuffix = 0;
        for (OrderPointEntity op : orderPointRepository.findByLocationId(locationId)) {
            Matcher sm = siblingPattern.matcher(op.getName());
            if (sm.matches()) {
                maxSuffix = Math.max(maxSuffix, Integer.parseInt(sm.group(1)));
            }
        }

        OrderPointEntity newOp = new OrderPointEntity();
        newOp.setName(prefix + (maxSuffix + 1));
        newOp.setPayLater(true);
        newOp.setLocation(source.getLocation());
        newOp.setMenu(source.getMenu());

        return orderPointMapper.toDto(orderPointRepository.save(newOp));
    }

    public OrderPoint updateOrderPoint(UUID id, UpdateOrderPointRequest request) {
        OrderPointEntity orderPointEntity = orderPointRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", request.getLocationId()));

        orderPointEntity.setName(request.getName());
        orderPointEntity.setPayLater(request.isPayLater());
        orderPointEntity.setLocation(location);

        if (request.getMenuId() != null) {
            MenuEntity menu = menuRepository.findById(request.getMenuId())
                    .orElseThrow(() -> new ResourceNotFoundException("Menu", request.getMenuId()));
            orderPointEntity.setMenu(menu);
        } else {
            orderPointEntity.setMenu(null);
        }

        OrderPointEntity updatedOrderPoint = orderPointRepository.save(orderPointEntity);
        return orderPointMapper.toDto(updatedOrderPoint);
    }
}