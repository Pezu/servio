package com.servio.event.service;

import com.servio.event.dto.EventOrderPoint;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.CashRegisterOrderPointEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.EventOrderPointEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.entity.UserEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.EventOrderPointMapper;
import com.servio.event.repository.CashRegisterOrderPointRepository;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.EventOrderPointRepository;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.UserRepository;
import com.servio.event.util.OrderPointNameComparator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventOrderPointService {

    /** Matches pay-later split names like {@code M3.1}, {@code M3.2}, ... */
    private static final Pattern PAY_LATER_NAME = Pattern.compile("^M(\\d+)\\.(\\d+)$");

    private final EventOrderPointRepository eventOrderPointRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final UserRepository userRepository;
    private final EventOrderPointMapper eventOrderPointMapper;
    private final CashRegisterOrderPointRepository cashRegisterOrderPointRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final OrderPointService orderPointService;

    @Transactional(readOnly = true)
    public List<EventOrderPoint> getEventOrderPoints(UUID eventId) {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        UUID locationId = event.getLocation().getId();
        Comparator<OrderPointEntity> sublocationThenName = Comparator
                .comparing((OrderPointEntity op) -> op.getLocation().getName(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(OrderPointNameComparator.by(OrderPointEntity::getName));
        List<OrderPointEntity> allOrderPoints = orderPointRepository.findByLocationIdIncludingSublocations(locationId)
                .stream()
                .sorted(sublocationThenName)
                .toList();

        // Cash register lookups: per-OP assignment is stored only on the canonical
        // row of each M{n} pay-later group, so resolve splits → canonical before
        // looking up the assignment.
        Map<UUID, UUID> canonicalByOrderPointId = canonicalByOrderPointId(allOrderPoints);
        Map<UUID, UUID> cashRegisterByOrderPointId = cashRegisterOrderPointRepository.findByEventId(eventId).stream()
                .collect(Collectors.toMap(
                        CashRegisterOrderPointEntity::getOrderPointId,
                        CashRegisterOrderPointEntity::getCashRegisterId,
                        (a, b) -> a));
        Map<UUID, CashRegisterEntity> cashRegistersById = cashRegisterRepository.findByEventId(eventId).stream()
                .collect(Collectors.toMap(CashRegisterEntity::getId, Function.identity()));

        List<EventOrderPointEntity> existingEntries = eventOrderPointRepository.findByEventIdWithDetails(eventId);
        Map<UUID, EventOrderPointEntity> existingByOrderPointId = existingEntries.stream()
                .collect(Collectors.toMap(e -> e.getOrderPoint().getId(), Function.identity()));

        return allOrderPoints.stream()
                .map(op -> {
                    EventOrderPointEntity existing = existingByOrderPointId.get(op.getId());
                    EventOrderPoint dto;
                    if (existing != null) {
                        dto = eventOrderPointMapper.toDto(existing);
                    } else {
                        dto = new EventOrderPoint();
                        dto.setEventId(eventId);
                        dto.setOrderPointId(op.getId());
                        dto.setOrderPointName(op.getName());
                        dto.setSublocationName(op.getLocation().getName());
                        dto.setPayLater(op.isPayLater());
                        dto.setPrepaid(BigDecimal.ZERO);
                    }
                    UUID canonicalId = canonicalByOrderPointId.getOrDefault(op.getId(), op.getId());
                    UUID crId = cashRegisterByOrderPointId.get(canonicalId);
                    if (crId != null) {
                        dto.setCashRegisterId(crId);
                        CashRegisterEntity cr = cashRegistersById.get(crId);
                        if (cr != null) {
                            dto.setCashRegisterName(cr.getName());
                        }
                    }
                    return dto;
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
        entity.setProtocol(request.isProtocol());
        // Only pay-later rows can carry a linked non-pay-later OP. Defensive
        // clear here so a non-pay-later row that flips wouldn't drag the
        // stale link along.
        entity.setLinkedOrderPointId(orderPoint.isPayLater() ? request.getLinkedOrderPointId() : null);

        List<UUID> requestedUserIds = request.getUserIds() != null ? request.getUserIds() : List.of();
        if (requestedUserIds.isEmpty()) {
            entity.getUsers().clear();
        } else {
            List<UserEntity> users = userRepository.findAllById(requestedUserIds);
            if (users.size() != requestedUserIds.size()) {
                throw new ResourceNotFoundException("User", requestedUserIds.toString());
            }
            entity.getUsers().clear();
            entity.getUsers().addAll(users);
        }

        EventOrderPointEntity saved = eventOrderPointRepository.save(entity);

        applyCashRegisterAssignment(eventId, orderPoint, request.getCashRegisterId());

        return getEventOrderPointDto(eventId, saved);
    }

    /**
     * Upsert the cash-register assignment for {@code orderPoint}, resolving
     * pay-later splits to their canonical row so all splits of an M{n} group
     * share the same cash register.
     */
    private void applyCashRegisterAssignment(UUID eventId, OrderPointEntity orderPoint, UUID requestedCashRegisterId) {
        UUID canonicalId = resolveCanonicalOrderPointId(orderPoint);

        List<CashRegisterOrderPointEntity> existingForOrderPoint = cashRegisterOrderPointRepository.findByEventId(eventId).stream()
                .filter(a -> a.getOrderPointId().equals(canonicalId))
                .collect(Collectors.toList());

        if (requestedCashRegisterId == null) {
            existingForOrderPoint.forEach(cashRegisterOrderPointRepository::delete);
            return;
        }

        CashRegisterEntity cashRegister = cashRegisterRepository.findById(requestedCashRegisterId)
                .orElseThrow(() -> new ResourceNotFoundException("CashRegister", requestedCashRegisterId));
        if (!eventId.equals(cashRegister.getEventId())) {
            throw new IllegalArgumentException("Cash register does not belong to this event");
        }

        CashRegisterOrderPointEntity keep = null;
        for (CashRegisterOrderPointEntity existing : existingForOrderPoint) {
            if (existing.getCashRegisterId().equals(requestedCashRegisterId) && keep == null) {
                keep = existing;
            } else {
                cashRegisterOrderPointRepository.delete(existing);
            }
        }
        if (keep == null) {
            // Flush the deletes (if any) before the insert so the unique
            // (event_id, order_point_id) constraint doesn't trip.
            cashRegisterOrderPointRepository.flush();
            cashRegisterOrderPointRepository.save(CashRegisterOrderPointEntity.builder()
                    .cashRegisterId(requestedCashRegisterId)
                    .eventId(eventId)
                    .orderPointId(canonicalId)
                    .createdAt(LocalDateTime.now())
                    .build());
        }
    }

    private EventOrderPoint getEventOrderPointDto(UUID eventId, EventOrderPointEntity entity) {
        EventOrderPoint dto = eventOrderPointMapper.toDto(entity);
        OrderPointEntity op = entity.getOrderPoint();
        UUID canonicalId = resolveCanonicalOrderPointId(op);
        cashRegisterOrderPointRepository.findByEventId(eventId).stream()
                .filter(a -> a.getOrderPointId().equals(canonicalId))
                .findFirst()
                .ifPresent(a -> {
                    dto.setCashRegisterId(a.getCashRegisterId());
                    cashRegisterRepository.findById(a.getCashRegisterId())
                            .ifPresent(cr -> dto.setCashRegisterName(cr.getName()));
                });
        return dto;
    }

    /**
     * For a pay-later split (M{n}.{m}), find the canonical sibling — the row
     * with the smallest {@code .m} suffix in the same location. For any other
     * order point, the canonical is the order point itself.
     */
    private UUID resolveCanonicalOrderPointId(OrderPointEntity op) {
        Matcher m = PAY_LATER_NAME.matcher(op.getName());
        if (!m.matches()) return op.getId();
        String groupNum = m.group(1);
        UUID locationId = op.getLocation().getId();
        OrderPointEntity canonical = op;
        int canonicalSuffix = Integer.parseInt(m.group(2));
        for (OrderPointEntity sibling : orderPointRepository.findByLocationId(locationId)) {
            Matcher sm = PAY_LATER_NAME.matcher(sibling.getName());
            if (!sm.matches() || !sm.group(1).equals(groupNum)) continue;
            int suffix = Integer.parseInt(sm.group(2));
            if (suffix < canonicalSuffix) {
                canonical = sibling;
                canonicalSuffix = suffix;
            }
        }
        return canonical.getId();
    }

    /** Build a map from every OP id (in the supplied list) → its canonical OP id. */
    private Map<UUID, UUID> canonicalByOrderPointId(List<OrderPointEntity> ops) {
        record GroupKey(UUID locationId, String groupNum) {}
        Map<GroupKey, OrderPointEntity> canonicals = new HashMap<>();
        Map<GroupKey, Integer> canonicalSuffix = new HashMap<>();
        for (OrderPointEntity op : ops) {
            Matcher m = PAY_LATER_NAME.matcher(op.getName());
            if (!m.matches()) continue;
            GroupKey key = new GroupKey(op.getLocation().getId(), m.group(1));
            int suffix = Integer.parseInt(m.group(2));
            Integer prev = canonicalSuffix.get(key);
            if (prev == null || suffix < prev) {
                canonicals.put(key, op);
                canonicalSuffix.put(key, suffix);
            }
        }
        Map<UUID, UUID> result = new HashMap<>();
        for (OrderPointEntity op : ops) {
            Matcher m = PAY_LATER_NAME.matcher(op.getName());
            if (m.matches()) {
                GroupKey key = new GroupKey(op.getLocation().getId(), m.group(1));
                OrderPointEntity canon = canonicals.get(key);
                if (canon != null) result.put(op.getId(), canon.getId());
            }
        }
        return result;
    }

    @Transactional
    public void deleteEventOrderPoint(UUID id) {
        eventOrderPointRepository.deleteById(id);
    }

    /**
     * Split a pay-later order point and seed the new sibling's per-event
     * configuration from the source row (users, client name/phone/email,
     * credit, protocol, prepaid). Cash-register assignment is intentionally
     * not duplicated — for M{n} groups the canonical row holds the CR and
     * splits inherit through it.
     *
     * Returns the new EventOrderPoint DTO with the same shape the Order
     * Points tab and the mobile Tables view consume.
     */
    @Transactional
    public EventOrderPoint splitForEvent(UUID eventId, UUID sourceOrderPointId) {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        // 1. Create the new order point (M{n}.{next}). Reuses the existing
        //    pay-later validation + naming rules in OrderPointService.
        UUID newOrderPointId = orderPointService.splitOrderPoint(sourceOrderPointId).getId();
        OrderPointEntity newOp = orderPointRepository.findById(newOrderPointId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderPoint", newOrderPointId));

        // 2. Copy the source's per-event configuration onto the new row.
        EventOrderPointEntity entity = new EventOrderPointEntity();
        entity.setEvent(event);
        entity.setOrderPoint(newOp);
        entity.setPrepaid(BigDecimal.ZERO);
        eventOrderPointRepository.findByEventIdAndOrderPointId(eventId, sourceOrderPointId)
                .ifPresent(src -> {
                    entity.setClientName(src.getClientName());
                    entity.setEmail(src.getEmail());
                    entity.setPhone(src.getPhone());
                    entity.setCredit(src.isCredit());
                    entity.setCreditValue(src.getCreditValue());
                    entity.setProtocol(src.isProtocol());
                    if (src.getPrepaid() != null) {
                        entity.setPrepaid(src.getPrepaid());
                    }
                    entity.getUsers().addAll(src.getUsers());
                });

        EventOrderPointEntity saved = eventOrderPointRepository.save(entity);
        return getEventOrderPointDto(eventId, saved);
    }
}