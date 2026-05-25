package com.servio.event.service;

import com.servio.event.dto.CashRegisterOrderPointsResponse;
import com.servio.event.dto.OrderPointSummary;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.CashRegisterOrderPointEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.repository.CashRegisterOrderPointRepository;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Manages the per-event mapping of order points to cash registers.
 * <p>
 * <b>Naming model</b> (mirrors {@code OrderPointService.generateNames}):
 * <ul>
 *   <li>Non-pay-later order points are independent rows named like {@code B1},
 *       {@code B2}, ... and each is its own assignable unit.</li>
 *   <li>Pay-later order points are always named {@code M{n}.{m}} — the first
 *       row in a group is created as {@code M3.1}, splits add {@code M3.2},
 *       {@code M3.3}, ... All siblings sharing the {@code M{n}} prefix
 *       represent one logical "M{n}" position. The user assigns the GROUP,
 *       not individual splits; the row with the smallest {@code .m} suffix
 *       is the canonical handle for the group.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class CashRegisterAssignmentService {

    /** {@code M{groupNum}.{suffix}} — produced by {@code OrderPointService}. */
    private static final Pattern PAY_LATER_NAME = Pattern.compile("^M(\\d+)\\.(\\d+)$");

    private final CashRegisterRepository cashRegisterRepository;
    private final CashRegisterOrderPointRepository assignmentRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;

    @Transactional(readOnly = true)
    public CashRegisterOrderPointsResponse getOrderPointsForCashRegister(UUID cashRegisterId) {
        CashRegisterEntity cashRegister = cashRegisterRepository.findById(cashRegisterId)
                .orElseThrow(() -> new ResourceNotFoundException("CashRegister", cashRegisterId));
        UUID eventId = cashRegister.getEventId();
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));
        UUID locationId = event.getLocation().getId();

        List<CashRegisterOrderPointEntity> allEventAssignments = assignmentRepository.findByEventId(eventId);
        Set<UUID> assignedToThis = allEventAssignments.stream()
                .filter(a -> a.getCashRegisterId().equals(cashRegisterId))
                .map(CashRegisterOrderPointEntity::getOrderPointId)
                .collect(Collectors.toSet());
        Set<UUID> assignedAnywhere = allEventAssignments.stream()
                .map(CashRegisterOrderPointEntity::getOrderPointId)
                .collect(Collectors.toSet());

        List<OrderPointEntity> allOps = orderPointRepository.findByLocationIdIncludingSublocations(locationId);
        Map<GroupKey, OrderPointEntity> canonicals = computeCanonicals(allOps);
        Set<UUID> canonicalIds = canonicals.values().stream()
                .map(OrderPointEntity::getId)
                .collect(Collectors.toSet());

        // Build the pool of assignable handles.
        //  - Pay-later: one summary per M{n} group, using the canonical row's id
        //    with display name "M{n}". Non-canonical siblings are suppressed.
        //  - Non-pay-later: pass through as-is.
        List<OrderPointSummary> pool = new ArrayList<>();
        for (OrderPointEntity op : allOps) {
            Matcher m = PAY_LATER_NAME.matcher(op.getName());
            if (m.matches()) {
                if (canonicalIds.contains(op.getId())) {
                    pool.add(new OrderPointSummary(op.getId(), "M" + m.group(1)));
                }
            } else {
                pool.add(new OrderPointSummary(op.getId(), op.getName()));
            }
        }
        pool.sort(Comparator.comparing(OrderPointSummary::getName));

        List<OrderPointSummary> assigned = pool.stream()
                .filter(s -> assignedToThis.contains(s.getId()))
                .collect(Collectors.toList());
        List<OrderPointSummary> assignable = pool.stream()
                .filter(s -> !assignedAnywhere.contains(s.getId()))
                .collect(Collectors.toList());

        return new CashRegisterOrderPointsResponse(assigned, assignable);
    }

    @Transactional
    public CashRegisterOrderPointsResponse setOrderPointsForCashRegister(UUID cashRegisterId, List<UUID> orderPointIds) {
        CashRegisterEntity cashRegister = cashRegisterRepository.findById(cashRegisterId)
                .orElseThrow(() -> new ResourceNotFoundException("CashRegister", cashRegisterId));
        UUID eventId = cashRegister.getEventId();
        List<UUID> requested = orderPointIds == null ? List.of() : orderPointIds;

        if (!requested.isEmpty()) {
            List<OrderPointEntity> entities = orderPointRepository.findAllById(requested);
            if (entities.size() != new HashSet<>(requested).size()) {
                throw new IllegalArgumentException("One or more order points not found");
            }

            // For every pay-later id in the request, verify the id is the canonical
            // of its M{n} group. Splits (non-canonical siblings) are only assignable
            // via their canonical handle — assigning them directly is rejected.
            Set<UUID> touchedLocations = entities.stream()
                    .map(op -> op.getLocation().getId())
                    .collect(Collectors.toSet());
            List<OrderPointEntity> siblingPool = new ArrayList<>();
            for (UUID lid : touchedLocations) {
                siblingPool.addAll(orderPointRepository.findByLocationId(lid));
            }
            Set<UUID> canonicalIds = computeCanonicals(siblingPool).values().stream()
                    .map(OrderPointEntity::getId)
                    .collect(Collectors.toSet());

            for (OrderPointEntity op : entities) {
                Matcher m = PAY_LATER_NAME.matcher(op.getName());
                if (m.matches() && !canonicalIds.contains(op.getId())) {
                    throw new IllegalArgumentException(
                            "Cannot assign split sub-order-point: " + op.getName()
                                    + " — assign the M" + m.group(1)
                                    + " group via its canonical row instead");
                }
            }

            // Plus the cross-cash-register conflict check (also enforced by the DB
            // unique constraint, but a clear error beats a raw constraint violation).
            Set<UUID> requestedSet = new HashSet<>(requested);
            boolean conflict = assignmentRepository.findByEventId(eventId).stream()
                    .filter(a -> !a.getCashRegisterId().equals(cashRegisterId))
                    .anyMatch(a -> requestedSet.contains(a.getOrderPointId()));
            if (conflict) {
                throw new IllegalArgumentException(
                        "Order point already assigned to another cash register in this event");
            }
        }

        // Replace the full set for this cash register. Flush the delete before the
        // inserts so the unique (event_id, order_point_id) constraint doesn't trip
        // when the same order point is re-added.
        assignmentRepository.deleteByCashRegisterId(cashRegisterId);
        assignmentRepository.flush();

        List<CashRegisterOrderPointEntity> toInsert = requested.stream()
                .map(opId -> CashRegisterOrderPointEntity.builder()
                        .cashRegisterId(cashRegisterId)
                        .eventId(eventId)
                        .orderPointId(opId)
                        .createdAt(LocalDateTime.now())
                        .build())
                .collect(Collectors.toList());
        assignmentRepository.saveAll(toInsert);

        return getOrderPointsForCashRegister(cashRegisterId);
    }

    /** Composite key: a pay-later M{n} group lives at one location. */
    private record GroupKey(UUID locationId, String groupNum) {}

    /**
     * For each {@code M{n}} group present in {@code ops}, find the canonical
     * sibling — the one with the smallest {@code .m} suffix. Order points whose
     * name doesn't match the pay-later pattern are skipped (they're standalone).
     */
    private Map<GroupKey, OrderPointEntity> computeCanonicals(Collection<OrderPointEntity> ops) {
        Map<GroupKey, OrderPointEntity> canon = new HashMap<>();
        Map<GroupKey, Integer> canonSuffix = new HashMap<>();
        for (OrderPointEntity op : ops) {
            Matcher m = PAY_LATER_NAME.matcher(op.getName());
            if (!m.matches()) continue;
            GroupKey key = new GroupKey(op.getLocation().getId(), m.group(1));
            int suffix = Integer.parseInt(m.group(2));
            Integer prevSuffix = canonSuffix.get(key);
            if (prevSuffix == null || suffix < prevSuffix) {
                canon.put(key, op);
                canonSuffix.put(key, suffix);
            }
        }
        return canon;
    }
}
