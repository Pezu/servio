package com.servio.event.service;

import com.servio.event.dto.Order;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service to enrich Order DTOs with additional data from related entities.
 * This separates data enrichment from pure mapping logic, making OrderMapper testable.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderDtoEnricher {

    private final OrderPointRepository orderPointRepository;
    private final EventRepository eventRepository;
    private final RegistrationRepository registrationRepository;

    /**
     * Enriches a single Order DTO with order point name, event name, nickname, and total amount.
     */
    public Order enrich(Order dto, OrderEntity entity) {
        enrichOrderPointName(dto, entity);
        enrichEventName(dto, entity);
        enrichNickname(dto, entity);
        calculateTotalAmount(dto, entity);
        return dto;
    }

    /**
     * Enriches a list of Order DTOs with batch-loaded data to avoid N+1 queries.
     */
    public List<Order> enrichBatch(List<Order> dtos, List<OrderEntity> entities) {
        if (dtos.isEmpty()) {
            return dtos;
        }

        // Collect unique order point IDs, event IDs, and registration IDs
        Set<UUID> orderPointIds = entities.stream()
                .map(OrderEntity::getOrderPointId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());

        Set<UUID> eventIds = entities.stream()
                .map(OrderEntity::getEventId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());

        Set<UUID> registrationIds = entities.stream()
                .map(OrderEntity::getRegistrationId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());

        // Batch load order point names
        Map<UUID, String> orderPointNames = orderPointRepository.findAllById(orderPointIds).stream()
                .collect(Collectors.toMap(op -> op.getId(), op -> op.getName()));

        // Batch load event names
        Map<UUID, String> eventNames = eventRepository.findAllById(eventIds).stream()
                .collect(Collectors.toMap(e -> e.getId(), e -> e.getName()));

        // Batch load registration nicknames
        Map<UUID, String> registrationNicknames = registrationRepository.findAllById(registrationIds).stream()
                .filter(r -> r.getNickname() != null)
                .collect(Collectors.toMap(RegistrationEntity::getId, RegistrationEntity::getNickname));

        log.info("Enriching {} orders with {} registration nicknames", dtos.size(), registrationNicknames.size());

        // Enrich each DTO
        for (int i = 0; i < dtos.size(); i++) {
            Order dto = dtos.get(i);
            OrderEntity entity = entities.get(i);

            if (entity.getOrderPointId() != null) {
                dto.setOrderPointName(orderPointNames.get(entity.getOrderPointId()));
            }
            if (entity.getEventId() != null) {
                dto.setEventName(eventNames.get(entity.getEventId()));
            }
            // Enrich nickname: use order's nickname if set, otherwise get from registration
            log.info("Order #{}: entity.nickname='{}', dto.nickname='{}', registrationId={}",
                    entity.getOrderNo(), entity.getNickname(), dto.getNickname(), entity.getRegistrationId());
            if (dto.getNickname() == null && entity.getRegistrationId() != null) {
                String regNickname = registrationNicknames.get(entity.getRegistrationId());
                log.info("  -> Setting from registration: '{}'", regNickname);
                dto.setNickname(regNickname);
            }
            calculateTotalAmount(dto, entity);
        }

        return dtos;
    }

    private void enrichOrderPointName(Order dto, OrderEntity entity) {
        if (entity.getOrderPointId() != null) {
            orderPointRepository.findById(entity.getOrderPointId())
                    .ifPresent(orderPoint -> dto.setOrderPointName(orderPoint.getName()));
        }
    }

    private void enrichEventName(Order dto, OrderEntity entity) {
        if (entity.getEventId() != null) {
            eventRepository.findNameById(entity.getEventId())
                    .ifPresent(dto::setEventName);
        }
    }

    private void enrichNickname(Order dto, OrderEntity entity) {
        // If order already has nickname, use it; otherwise get from registration
        if (dto.getNickname() == null && entity.getRegistrationId() != null) {
            registrationRepository.findById(entity.getRegistrationId())
                    .map(RegistrationEntity::getNickname)
                    .ifPresent(dto::setNickname);
        }
    }

    private void calculateTotalAmount(Order dto, OrderEntity entity) {
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