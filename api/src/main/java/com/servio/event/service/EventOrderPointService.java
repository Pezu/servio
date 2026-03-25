package com.servio.event.service;

import com.servio.event.dto.EventOrderPoint;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.EventOrderPointEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.EventOrderPointMapper;
import com.servio.event.repository.EventOrderPointRepository;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventOrderPointService {

    private final EventOrderPointRepository eventOrderPointRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final EventOrderPointMapper eventOrderPointMapper;

    @Transactional(readOnly = true)
    public List<EventOrderPoint> getEventOrderPoints(UUID eventId) {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        // Get all order points for the event's location (including sublocations)
        // Only include order points with payLater = true
        UUID locationId = event.getLocation().getId();
        List<OrderPointEntity> allOrderPoints = orderPointRepository.findByLocationIdIncludingSublocations(locationId)
                .stream()
                .filter(OrderPointEntity::isPayLater)
                .toList();

        // Get existing event order point entries
        List<EventOrderPointEntity> existingEntries = eventOrderPointRepository.findByEventIdWithDetails(eventId);
        Map<UUID, EventOrderPointEntity> existingByOrderPointId = existingEntries.stream()
                .collect(Collectors.toMap(e -> e.getOrderPoint().getId(), Function.identity()));

        // Build result list, creating virtual entries for order points without data
        return allOrderPoints.stream()
                .map(op -> {
                    EventOrderPointEntity existing = existingByOrderPointId.get(op.getId());
                    if (existing != null) {
                        return eventOrderPointMapper.toDto(existing);
                    } else {
                        // Create a virtual entry (not persisted)
                        EventOrderPoint dto = new EventOrderPoint();
                        dto.setEventId(eventId);
                        dto.setOrderPointId(op.getId());
                        dto.setOrderPointName(op.getName());
                        dto.setSublocationName(op.getLocation().getName());
                        dto.setPrepaid(BigDecimal.ZERO);
                        return dto;
                    }
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public EventOrderPoint saveEventOrderPoint(UUID eventId, UUID orderPointId, EventOrderPoint request) {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        OrderPointEntity orderPoint = orderPointRepository.findById(orderPointId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", orderPointId));

        EventOrderPointEntity entity = eventOrderPointRepository
                .findByEventIdAndOrderPointId(eventId, orderPointId)
                .orElseGet(() -> {
                    EventOrderPointEntity newEntity = new EventOrderPointEntity();
                    newEntity.setEvent(event);
                    newEntity.setOrderPoint(orderPoint);
                    return newEntity;
                });

        entity.setPrepaid(request.getPrepaid() != null ? request.getPrepaid() : BigDecimal.ZERO);
        entity.setClientName(request.getClientName());
        entity.setEmail(request.getEmail());
        entity.setPhone(request.getPhone());
        entity.setCredit(request.isCredit());
        entity.setCreditValue(request.isCredit() ? request.getCreditValue() : null);

        EventOrderPointEntity saved = eventOrderPointRepository.save(entity);
        return eventOrderPointMapper.toDto(saved);
    }

    @Transactional
    public void deleteEventOrderPoint(UUID id) {
        eventOrderPointRepository.deleteById(id);
    }
}
