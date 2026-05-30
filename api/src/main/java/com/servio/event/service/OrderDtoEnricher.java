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
import java.math.RoundingMode;
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
    private final com.servio.event.repository.FiscalReceiptRepository fiscalReceiptRepository;

    /**
     * Fills fiscal-receipt numbers on a list of already-mapped orders + their
     * payments, using two batch queries (no N+1):
     *  - per payment row → its receipt, matched by payment_ref;
     *  - per order → its latest issued receipt (for card/synthetic payments that
     *    have no payment row).
     * {@code dtos} and {@code entities} must be index-aligned (same order).
     */
    public void enrichFiscal(List<Order> dtos, List<OrderEntity> entities) {
        if (dtos.isEmpty()) return;

        Set<UUID> refs = entities.stream()
                .flatMap(e -> e.getPayments().stream())
                .map(com.servio.event.entity.OrderPaymentEntity::getPaymentRef)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        Set<UUID> orderIds = entities.stream().map(OrderEntity::getId).collect(Collectors.toSet());

        Map<UUID, com.servio.event.entity.FiscalReceiptEntity> byRef = refs.isEmpty() ? Map.of()
                : fiscalReceiptRepository.findIssuedByPaymentRefs(refs).stream()
                    .collect(Collectors.toMap(com.servio.event.entity.FiscalReceiptEntity::getPaymentRef, r -> r, (a, b) -> a));

        Map<UUID, com.servio.event.entity.FiscalReceiptEntity> byOrder = new java.util.HashMap<>();
        if (!orderIds.isEmpty()) {
            for (var r : fiscalReceiptRepository.findIssuedByOrderIds(orderIds)) {
                for (UUID oid : r.getOrderIds()) {
                    byOrder.merge(oid, r, (a, b) ->
                            a.getAttemptedAt() != null && b.getAttemptedAt() != null && a.getAttemptedAt().isAfter(b.getAttemptedAt()) ? a : b);
                }
            }
        }

        for (int i = 0; i < dtos.size(); i++) {
            Order dto = dtos.get(i);
            OrderEntity entity = entities.get(i);
            var orderR = byOrder.get(entity.getId());
            if (orderR != null) {
                dto.setFiscalReceiptId(orderR.getFiscalReceiptId());
                dto.setReceiptNumber(orderR.getReceiptNumber());
            }
            var pdtos = dto.getPayments();
            var pents = entity.getPayments();
            if (pdtos != null && pents != null) {
                for (int j = 0; j < pdtos.size() && j < pents.size(); j++) {
                    UUID ref = pents.get(j).getPaymentRef();
                    var r = ref != null ? byRef.get(ref) : null;
                    if (r != null) {
                        pdtos.get(j).setFiscalReceiptId(r.getFiscalReceiptId());
                        pdtos.get(j).setReceiptNumber(r.getReceiptNumber());
                    }
                }
            }
        }
    }

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
            BigDecimal total = BigDecimal.ZERO;
            BigDecimal netTotal = BigDecimal.ZERO;

            for (var item : entity.getItems()) {
                BigDecimal itemTotal = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                total = total.add(itemTotal);

                // Calculate net from inclusive price: netAmount = itemTotal / (1 + vatRate/100)
                BigDecimal vatRate = item.getVatRate() != null ? item.getVatRate() : BigDecimal.ZERO;
                if (vatRate.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal divisor = BigDecimal.ONE.add(vatRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP));
                    BigDecimal itemNet = itemTotal.divide(divisor, 2, RoundingMode.HALF_UP);
                    netTotal = netTotal.add(itemNet);
                } else {
                    // No VAT - net equals total
                    netTotal = netTotal.add(itemTotal);
                }
            }

            dto.setTotalAmount(total);
            dto.setNetAmount(netTotal);
            dto.setVatAmount(total.subtract(netTotal));
        } else {
            dto.setTotalAmount(BigDecimal.ZERO);
            dto.setVatAmount(BigDecimal.ZERO);
            dto.setNetAmount(BigDecimal.ZERO);
        }
    }
}