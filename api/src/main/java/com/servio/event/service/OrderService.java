package com.servio.event.service;

import com.servio.event.dto.PartialMarkPaidRequest;
import com.servio.event.dto.ReceiveOrderRequest;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderGroupEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderPaymentEntity;
import com.servio.event.entity.OrderStatus;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationOrderPointEntity;
import com.servio.event.event.PaymentCompletedEvent;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderMapper;
import com.servio.event.repository.EventOrderPointRepository;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.MenuItemRepository;
import com.servio.event.repository.OrderGroupRepository;
import com.servio.event.repository.OrderItemRepository;
import com.servio.event.repository.OrderPaymentRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.OrderRepository;
import com.servio.event.repository.RegistrationOrderPointRepository;
import com.servio.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderPaymentRepository orderPaymentRepository;
    private final OrderGroupRepository orderGroupRepository;
    private final RegistrationRepository registrationRepository;
    private final RegistrationOrderPointRepository registrationOrderPointRepository;
    private final EventRepository eventRepository;
    private final MenuItemRepository menuItemRepository;
    private final OrderNotificationService notificationService;
    private final OrderMapper orderMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final OrderPointRepository orderPointRepository;
    private final EventOrderPointRepository eventOrderPointRepository;

    @Transactional
    public OrderEntity createOrder(ReceiveOrderRequest request) {
        RegistrationEntity registration = registrationRepository.findById(request.getRegistrationId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration", request.getRegistrationId()));

        // Customer registrations need an APPROVED junction at the OP they're
        // ordering against. Waiter registrations (user != null) bypass per-OP
        // validation — they place orders against any OP they're assigned to.
        if (registration.getUser() == null) {
            RegistrationOrderPointEntity junction = registrationOrderPointRepository
                    .findByRegistrationIdAndOrderPointId(registration.getId(), request.getOrderPointId())
                    .orElseThrow(() -> new BusinessException("Order point not registered for this customer"));
            if (junction.getValidationStatus() != RegistrationEntity.ValidationStatus.APPROVED) {
                throw new BusinessException("Order point is pending approval");
            }
        }

        UUID eventId = registration.getEvent().getId();

        // Atomically increment and get the next order number to prevent race conditions
        Integer nextOrderNo = eventRepository.incrementAndGetLastOrderNo(eventId);

        // Use MapStruct for entity creation
        OrderEntity order = orderMapper.toEntity(request);
        order.setEventId(eventId);
        order.setOrderNo(nextOrderNo);

        // Handle pay later: set status to ACTIVE and flag needsPayment
        if (request.isPayLater()) {
            order.setStatus(OrderStatus.ACTIVE);
            order.setNeedsPayment(true);
        } else {
            order.setStatus(OrderStatus.DRAFT);
        }

        // Resolve the group: join an existing ACTIVE order's group at the same
        // order point, or create a new group. Once an order leaves ACTIVE its
        // group is "frozen" and any subsequent order at the same OP starts fresh.
        order.setGroupId(resolveOrderGroupId(order.getOrderPointId()));

        // Tag where the order is *served from*:
        //  - non-pay-later OP (bar/quick-serve) → itself
        //  - pay-later OP (table) → the linked bar configured for that table
        //    in Edit Event → Order Points → Bar (may be null if unset)
        order.setServiceOrderPointId(resolveServiceOrderPointId(eventId, order.getOrderPointId()));

        // Copy nickname from registration to order
        log.info("Creating order: registration.nickname='{}', order.nickname before='{}'",
                registration.getNickname(), order.getNickname());
        if (registration.getNickname() != null) {
            order.setNickname(registration.getNickname());
            log.info("Set order.nickname to '{}'", order.getNickname());
        }

        // Look up VAT rates from menu items
        List<UUID> menuItemIds = request.getOrderItems().stream()
                .map(com.servio.event.dto.OrderItem::getMenuItemId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toList());

        java.util.Map<UUID, BigDecimal> vatRatesByMenuItemId = new java.util.HashMap<>();
        if (!menuItemIds.isEmpty()) {
            menuItemRepository.findByIdInWithVatType(menuItemIds).forEach(menuItem -> {
                BigDecimal vatRate = menuItem.getVatType() != null ? menuItem.getVatType().getValue() : BigDecimal.ZERO;
                vatRatesByMenuItemId.put(menuItem.getId(), vatRate);
            });
        }

        // Create order items with VAT rates
        request.getOrderItems().stream()
                .map(itemDto -> {
                    OrderItemEntity entity = orderMapper.toEntity(itemDto);
                    if (itemDto.getMenuItemId() != null) {
                        BigDecimal vatRate = vatRatesByMenuItemId.getOrDefault(itemDto.getMenuItemId(), BigDecimal.ZERO);
                        entity.setVatRate(vatRate);
                    }
                    return entity;
                })
                .forEach(order::addItem);

        OrderEntity savedOrder = orderRepository.save(order);

        // Only notify for ACTIVE orders (pay-later flow).
        // DRAFT orders (pay-now) should not appear in order management until confirmed.
        if (savedOrder.getStatus() == OrderStatus.ACTIVE) {
            notificationService.notifyOrderCreated(savedOrder);
        }

        return savedOrder;
    }

    public List<OrderEntity> getOrdersByEventId(UUID eventId) {
        return orderRepository.findByEventIdAndStatusNotIn(eventId, List.of(OrderStatus.DRAFT, OrderStatus.DELIVERED, OrderStatus.CANCELLED));
    }

    /** Closed orders for the event — i.e. delivered/completed (terminal) ones. */
    public List<OrderEntity> getClosedOrdersByEventId(UUID eventId) {
        return orderRepository.findByEventIdAndStatus(eventId, OrderStatus.DELIVERED);
    }

    /**
     * Kanban scope: orders for the event where {@code serviceOrderPointId}
     * matches an OP the username is assigned to via Edit Event → Order Points.
     * Returns empty when the user isn't assigned to any OP in this event.
     */
    public List<OrderEntity> getOrdersByEventIdForUser(UUID eventId, String username) {
        List<UUID> assignedOpIds = eventOrderPointRepository
                .findOrderPointIdsByEventIdAndUserUsername(eventId, username);
        if (assignedOpIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findByEventIdAndStatusNotInAndServiceOrderPointIdIn(
                eventId,
                List.of(OrderStatus.DRAFT, OrderStatus.DELIVERED, OrderStatus.CANCELLED),
                assignedOpIds);
    }

    /**
     * Where the order's service originates. Non-pay-later OPs serve themselves;
     * pay-later OPs route to the linked bar configured in Edit Event → Order
     * Points (may be null if unset).
     */
    private UUID resolveServiceOrderPointId(UUID eventId, UUID orderPointId) {
        if (orderPointId == null) return null;
        return orderPointRepository.findById(orderPointId)
                .map(op -> {
                    if (!op.isPayLater()) return op.getId();
                    return eventOrderPointRepository.findByEventIdAndOrderPointId(eventId, orderPointId)
                            .map(eop -> eop.getLinkedOrderPointId())
                            .orElse(null);
                })
                .orElse(null);
    }

    private UUID resolveOrderGroupId(UUID orderPointId) {
        if (orderPointId == null) {
            return createNewGroup(null).getId();
        }
        return orderRepository.findByOrderPointIdAndStatus(orderPointId, OrderStatus.ACTIVE).stream()
                .map(OrderEntity::getGroupId)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElseGet(() -> createNewGroup(orderPointId).getId());
    }

    private OrderGroupEntity createNewGroup(UUID orderPointId) {
        OrderGroupEntity group = new OrderGroupEntity();
        group.setOrderPointId(orderPointId);
        return orderGroupRepository.save(group);
    }

    public List<OrderEntity> getOrdersNeedingPayment(UUID eventId) {
        return orderRepository.findByEventIdAndNeedsPaymentTrue(eventId);
    }

    public List<OrderEntity> getOrdersByOrderPointIdForRegistration(UUID orderPointId, UUID registrationId) {
        // The caller must already be registered at this OP via a junction row.
        registrationOrderPointRepository.findByRegistrationIdAndOrderPointId(registrationId, orderPointId)
                .orElseThrow(() -> new BusinessException("Registration is not associated with this order point"));

        return orderRepository.findByOrderPointIdAndStatusNotIn(orderPointId, List.of(OrderStatus.DRAFT, OrderStatus.CANCELLED));
    }

    @Transactional
    public OrderEntity confirmOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (order.getStatus() != OrderStatus.DRAFT) {
            throw new BusinessException("Order is not in DRAFT status");
        }

        order.setStatus(OrderStatus.ACTIVE);

        // Check if items are already paid (IPN may have arrived before redirect)
        boolean allItemsPaid = order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .allMatch(item -> item.isPaid());

        // Only set needsPayment if items are NOT already paid
        if (!allItemsPaid) {
            order.setNeedsPayment(true);
        }

        OrderEntity savedOrder = orderRepository.save(order);

        // Now that order is ACTIVE, notify order management
        notificationService.notifyOrderCreated(savedOrder);

        return savedOrder;
    }

    public List<OrderEntity> getOrdersByRegistrationId(UUID registrationId) {
        return orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId);
    }

    public Page<OrderEntity> getAllOrders(Pageable pageable) {
        return orderRepository.findAllOrders(pageable);
    }

    public Page<OrderEntity> getOrdersByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return orderRepository.findByCreatedAtBetween(startDate, endDate, pageable);
    }

    public Page<OrderEntity> getOrdersByEventIdPaged(UUID eventId, Pageable pageable) {
        return orderRepository.findByEventIdPaged(eventId, pageable);
    }

    public Page<OrderEntity> getOrdersByEventIdAndDateRange(UUID eventId, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return orderRepository.findByEventIdAndCreatedAtBetween(eventId, startDate, endDate, pageable);
    }

    public OrderEntity getOrderById(UUID orderId) {
        return orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
    }

    @Transactional
    public OrderItemEntity updateOrderItemStatus(UUID orderItemId, OrderItemStatus status) {
        OrderItemEntity orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderItem", orderItemId));

        OrderItemStatus previousItemStatus = orderItem.getStatus();
        orderItem.setStatus(status);
        orderItemRepository.save(orderItem);

        notificationService.notifyItemStatusChange(orderItem, previousItemStatus, status);
        updateOrderStatusBasedOnItems(orderItem.getOrder());

        return orderItem;
    }

    @Transactional
    public OrderEntity deleteOrderItem(UUID orderItemId) {
        OrderItemEntity orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderItem", orderItemId));
        if (orderItem.isPaid()) {
            throw new BusinessException("Cannot delete a paid item");
        }
        OrderEntity order = orderItem.getOrder();
        order.getItems().removeIf(i -> i.getId().equals(orderItemId));
        orderRepository.save(order);
        updateOrderStatusBasedOnItems(order);
        return order;
    }

    /**
     * Adjusts an item's quantity by `delta` (positive or negative). When the
     * resulting quantity is &le; 0 the item is hard-deleted. Refuses to touch
     * paid items.
     */
    @Transactional
    public OrderEntity adjustOrderItemQuantity(UUID orderItemId, int delta) {
        OrderItemEntity orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderItem", orderItemId));
        if (orderItem.isPaid()) {
            throw new BusinessException("Cannot edit a paid item");
        }
        int next = orderItem.getQuantity() + delta;
        if (next <= 0) {
            return deleteOrderItem(orderItemId);
        }
        orderItem.setQuantity(next);
        orderItemRepository.save(orderItem);
        return orderItem.getOrder();
    }

    private void updateOrderStatusBasedOnItems(OrderEntity order) {
        OrderStatus previousOrderStatus = order.getStatus();

        // Determine new status based on item statuses using functional approach
        determineNewOrderStatus(order)
                .filter(newStatus -> newStatus != previousOrderStatus)
                .ifPresent(newStatus -> {
                    order.setStatus(newStatus);
                    orderRepository.save(order);
                    notificationService.notifyOrderStatusChange(order, previousOrderStatus, newStatus);
                });
    }

    private Optional<OrderStatus> determineNewOrderStatus(OrderEntity order) {
        boolean allItemsCancelled = order.getItems().stream()
                .allMatch(item -> item.getStatus() == OrderItemStatus.CANCELLED);

        if (allItemsCancelled) {
            return Optional.of(OrderStatus.CANCELLED);
        }

        return Optional.empty();
    }

    /**
     * Completes an order by transitioning it from IN_PROGRESS to READY. Item-level
     * validation has been removed, so items keep their existing status.
     */
    @Transactional
    public OrderEntity completeOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        OrderStatus previousStatus = order.getStatus();
        order.setStatus(OrderStatus.READY);

        OrderEntity savedOrder = orderRepository.save(order);
        notificationService.notifyOrderStatusChange(savedOrder, previousStatus, OrderStatus.READY);

        return savedOrder;
    }

    @Transactional
    public OrderEntity updateOrderStatus(UUID orderId, OrderStatus status, String user) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        OrderStatus previousStatus = order.getStatus();

        // If returning to ACTIVE, clear the assigned user. Items keep their status
        // (only ORDERED or CANCELLED — there is no DONE/PREPARING anymore).
        if (status == OrderStatus.ACTIVE) {
            order.setAssignedUser(null);
        }

        order.setStatus(status);
        Optional.ofNullable(user).ifPresent(order::setAssignedUser);

        OrderEntity savedOrder = orderRepository.save(order);
        notificationService.notifyOrderStatusChange(savedOrder, previousStatus, status);

        return savedOrder;
    }

    /**
     * Atomically transitions every non-terminal order in the given group to the new
     * status. Used by the kanban "drag the table card to a new column" / single-button
     * group actions so the front-end sees one coherent state change instead of N
     * interleaved per-order updates that flash a half-moved group.
     */
    @Transactional
    public List<OrderEntity> updateGroupStatus(UUID groupId, OrderStatus status, String user) {
        List<OrderEntity> orders = orderRepository.findByGroupIdAndStatusNotIn(
                groupId, List.of(OrderStatus.DRAFT, OrderStatus.DELIVERED, OrderStatus.CANCELLED));
        if (orders.isEmpty()) {
            return orders;
        }

        List<OrderEntity> updated = new java.util.ArrayList<>(orders.size());
        java.util.List<OrderStatus> previousStatuses = new java.util.ArrayList<>(orders.size());
        for (OrderEntity order : orders) {
            previousStatuses.add(order.getStatus());
            if (status == OrderStatus.ACTIVE) {
                order.setAssignedUser(null);
            }
            order.setStatus(status);
            Optional.ofNullable(user).ifPresent(order::setAssignedUser);
            updated.add(orderRepository.save(order));
        }

        for (int i = 0; i < updated.size(); i++) {
            notificationService.notifyOrderStatusChange(updated.get(i), previousStatuses.get(i), status);
        }
        return updated;
    }

    /**
     * Handles payment completion for an order.
     * Marks all non-cancelled items as paid and clears the needsPayment flag.
     *
     * @param orderId The order ID
     * @return Number of items marked as paid
     */
    @Transactional
    public int handlePaymentComplete(UUID orderId) {
        return handlePaymentComplete(orderId, null, null);
    }

    /**
     * Handles payment completion for an order with payment method tracking.
     *
     * @param orderId The order ID
     * @param paymentMethod The payment method (CASH or CARD)
     * @param paidBy Who marked the order as paid
     * @return Number of items marked as paid
     */
    @Transactional
    public int handlePaymentComplete(UUID orderId, String paymentMethod, String paidBy) {
        return handlePaymentComplete(orderId, paymentMethod, paidBy, null, null);
    }

    /**
     * @param settledItemIdsOut when non-null, the ids of the items this call
     *        actually marked paid are appended — so the fiscal receipt can be
     *        scoped to exactly what was settled now (not the whole order, which
     *        would re-print items already fiscalized by an earlier installment).
     * @param paymentRef stable per-transaction id stamped on the payment row so it
     *        can be matched to its fiscal receipt; null for standalone marks.
     */
    @Transactional
    public int handlePaymentComplete(UUID orderId, String paymentMethod, String paidBy,
                                     List<UUID> settledItemIdsOut, UUID paymentRef) {
        var orderOpt = orderRepository.findByIdWithItems(orderId);
        if (orderOpt.isEmpty()) {
            log.warn("Order not found for payment completion: {}", orderId);
            return 0;
        }

        OrderEntity order = orderOpt.get();
        int itemsMarkedPaid = 0;
        BigDecimal amountPaid = BigDecimal.ZERO;

        log.info("Processing payment completion for order {} with {} items", orderId, order.getItems().size());

        for (var item : order.getItems()) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            if (!item.isPaid()) {
                item.setPaid(true);
                itemsMarkedPaid++;
                if (settledItemIdsOut != null) settledItemIdsOut.add(item.getId());
                amountPaid = amountPaid.add(item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
                log.info("Marked item {} as paid", item.getId());
            }
        }

        // Clear needsPayment flag and set payment info
        order.setNeedsPayment(false);
        if (paymentMethod != null) {
            order.setPaymentMethod(paymentMethod);
        }
        if (paidBy != null) {
            order.setPaidBy(paidBy);
        }
        if (paymentMethod != null || paidBy != null) {
            order.setPaidAt(LocalDateTime.now());
        }
        // Count this as one payment transaction against the order (only when it
        // actually settled something — re-confirming an already-paid order doesn't count).
        if (itemsMarkedPaid > 0) {
            order.setPaymentCount(order.getPaymentCount() + 1);
            recordPayment(order, amountPaid, paymentMethod, paidBy, paymentRef);
        }
        orderRepository.save(order);

        log.info("Payment complete for order {}: {} items marked as paid via {} by {}", orderId, itemsMarkedPaid, paymentMethod, paidBy);

        // Notify via SQS for WebSocket relay
        notificationService.notifyPaymentCompleted(order, itemsMarkedPaid);

        return itemsMarkedPaid;
    }

    /**
     * Marks a batch of orders paid in one transaction (backoffice Collect flow).
     * After the transaction commits, fires a single {@link PaymentCompletedEvent}
     * so the cash-register listener prints ONE receipt covering all the orders
     * — same mechanism as the Netopia callback path.
     *
     * Skips the per-order PATCH cadence (each call would publish its own event
     * → one print per order, not one per Collect).
     */
    @Transactional
    public int markOrdersPaidBulk(List<UUID> orderIds, String paymentMethod, String paidBy, String cashRegisterDeviceId) {
        return markOrdersPaidBulk(orderIds, paymentMethod, paidBy, cashRegisterDeviceId, null);
    }

    @Transactional
    public int markOrdersPaidBulk(List<UUID> orderIds, String paymentMethod, String paidBy, String cashRegisterDeviceId, BigDecimal tip) {
        if (orderIds == null || orderIds.isEmpty()) {
            return 0;
        }
        int totalItemsMarked = 0;
        List<UUID> processed = new ArrayList<>(orderIds.size());
        // Items actually settled in THIS transaction — the receipt is scoped to
        // these so a Pay-All after an earlier partial doesn't reprint (and double-
        // fiscalize) items already covered by the partial's receipt.
        List<UUID> settledItemIds = new ArrayList<>();
        // One stable id for this whole payment transaction, stamped on every
        // settled order's payment row and its fiscal receipt.
        UUID paymentRef = UUID.randomUUID();
        for (UUID orderId : orderIds) {
            int marked = handlePaymentComplete(orderId, paymentMethod, paidBy, settledItemIds, paymentRef);
            totalItemsMarked += marked;
            processed.add(orderId);
        }
        applyTipToOrders(processed, tip);
        if (paymentMethod != null) {
            eventPublisher.publishEvent(new PaymentCompletedEvent(processed, paymentMethod, cashRegisterDeviceId, paidBy,
                    settledItemIds.isEmpty() ? null : settledItemIds, tip, paymentRef));
        }
        return totalItemsMarked;
    }

    /**
     * Partial-pay flow (mobile Payments → Pay → Partial): settle only the
     * chosen items/quantities of an order point.
     *
     * <p>For each requested {@code (orderItemId, quantity)}:
     * <ul>
     *   <li>full quantity → the item is flagged paid in place;</li>
     *   <li>partial quantity → the item is <b>split</b>: the original keeps the
     *       unpaid remainder, a new sibling row carries the paid units (so the
     *       unit price / VAT / name stay intact for the fiscal receipt).</li>
     * </ul>
     *
     * An order only loses its {@code needsPayment} flag (and gets stamped with
     * payment metadata) once every non-cancelled item on it is paid. After
     * commit, one {@link PaymentCompletedEvent} fires scoped to exactly the
     * settled rows, so the receipt covers only what was paid now — not the
     * remainder, and not units settled by an earlier partial payment.
     *
     * @return total units settled across all items
     */
    @Transactional
    public int markItemsPaidPartial(PartialMarkPaidRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            return 0;
        }

        List<UUID> paidItemIds = new ArrayList<>();
        java.util.Set<UUID> affectedOrderIds = new java.util.LinkedHashSet<>();
        java.util.Map<UUID, Integer> unitsPaidByOrder = new java.util.HashMap<>();
        // Amount settled now per order — computed inline (not re-read) so a
        // freshly-persisted split row that the managed collection hasn't picked
        // up yet can't skew the tip distribution.
        java.util.Map<UUID, BigDecimal> paidAmountByOrder = new java.util.HashMap<>();
        int totalUnitsPaid = 0;

        for (PartialMarkPaidRequest.Item reqItem : request.getItems()) {
            if (reqItem == null || reqItem.getOrderItemId() == null || reqItem.getQuantity() <= 0) {
                continue;
            }
            OrderItemEntity item = orderItemRepository.findById(reqItem.getOrderItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrderItem", reqItem.getOrderItemId()));
            if (item.getStatus() == OrderItemStatus.CANCELLED || item.isPaid()) {
                continue;
            }
            int payQty = Math.min(reqItem.getQuantity(), item.getQuantity());
            OrderEntity order = item.getOrder();
            UUID orderId = order.getId();
            affectedOrderIds.add(orderId);

            if (payQty >= item.getQuantity()) {
                // Whole line settled.
                item.setPaid(true);
                orderItemRepository.save(item);
                paidItemIds.add(item.getId());
            } else {
                // Split: original keeps the unpaid remainder; new row carries the paid units.
                item.setQuantity(item.getQuantity() - payQty);
                orderItemRepository.save(item);

                OrderItemEntity paidPart = new OrderItemEntity();
                paidPart.setOrder(order);
                paidPart.setName(item.getName());
                paidPart.setPrice(item.getPrice());
                paidPart.setQuantity(payQty);
                paidPart.setStatus(item.getStatus());
                paidPart.setNote(item.getNote());
                paidPart.setPaid(true);
                paidPart.setVatRate(item.getVatRate());
                paidPart = orderItemRepository.save(paidPart);
                paidItemIds.add(paidPart.getId());
            }
            totalUnitsPaid += payQty;
            unitsPaidByOrder.merge(orderId, payQty, Integer::sum);
            paidAmountByOrder.merge(orderId,
                    item.getPrice().multiply(BigDecimal.valueOf(payQty)), BigDecimal::add);
        }

        if (paidItemIds.isEmpty()) {
            return 0;
        }

        // Finalize each affected order: clear needsPayment + stamp metadata only
        // once everything on the order is paid; otherwise leave it pending.
        List<UUID> processed = new ArrayList<>(affectedOrderIds);
        // One stable id for this partial transaction → its payment rows + receipt.
        UUID paymentRef = UUID.randomUUID();
        for (UUID orderId : processed) {
            OrderEntity order = orderRepository.findByIdWithItems(orderId)
                    .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
            boolean fullyPaid = order.getItems().stream()
                    .filter(i -> i.getStatus() != OrderItemStatus.CANCELLED)
                    .allMatch(OrderItemEntity::isPaid);
            // Each partial transaction that touched this order is one payment.
            order.setPaymentCount(order.getPaymentCount() + 1);
            recordPayment(order, paidAmountByOrder.getOrDefault(orderId, BigDecimal.ZERO),
                    request.getPaymentMethod(), request.getPaidBy(), paymentRef);
            if (fullyPaid) {
                order.setNeedsPayment(false);
                if (request.getPaymentMethod() != null) {
                    order.setPaymentMethod(request.getPaymentMethod());
                }
                if (request.getPaidBy() != null) {
                    order.setPaidBy(request.getPaidBy());
                }
                order.setPaidAt(LocalDateTime.now());
            }
            orderRepository.save(order);
            notificationService.notifyPaymentCompleted(order, unitsPaidByOrder.getOrDefault(orderId, 0));
        }

        applyPartialTip(processed, paidAmountByOrder, request.getTip());

        if (request.getPaymentMethod() != null) {
            eventPublisher.publishEvent(new PaymentCompletedEvent(
                    processed, request.getPaymentMethod(), request.getCashRegisterDeviceId(),
                    request.getPaidBy(), paidItemIds, request.getTip(), paymentRef));
        }

        log.info("Partial-paid {} unit(s) across {} order(s) via {} by {}",
                totalUnitsPaid, processed.size(), request.getPaymentMethod(), request.getPaidBy());
        return totalUnitsPaid;
    }

    /** Persist one payment-transaction row against the order (revenue-report breakdown). */
    private void recordPayment(OrderEntity order, BigDecimal amount, String paymentMethod, String paidBy, UUID paymentRef) {
        OrderPaymentEntity payment = new OrderPaymentEntity();
        payment.setOrder(order);
        payment.setAmount(amount != null ? amount : BigDecimal.ZERO);
        payment.setPaymentMethod(paymentMethod);
        payment.setPaidBy(paidBy);
        payment.setPaidAt(LocalDateTime.now());
        payment.setPaymentRef(paymentRef);
        orderPaymentRepository.save(payment);
    }

    /**
     * Distribute a tip across the orders touched by a partial payment, weighted
     * by the amount actually settled now ({@code paidAmountByOrder}). Accumulates
     * onto any existing order tip so multiple partial payments on the same order
     * each add their share.
     */
    private void applyPartialTip(List<UUID> orderIds, java.util.Map<UUID, BigDecimal> paidAmountByOrder, BigDecimal totalTip) {
        if (totalTip == null || totalTip.compareTo(BigDecimal.ZERO) <= 0 || orderIds.isEmpty()) {
            return;
        }
        BigDecimal totalPaidAmount = orderIds.stream()
                .map(id -> paidAmountByOrder.getOrDefault(id, BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remaining = totalTip;
        for (int i = 0; i < orderIds.size(); i++) {
            UUID orderId = orderIds.get(i);
            var opt = orderRepository.findById(orderId);
            if (opt.isEmpty()) continue;
            OrderEntity o = opt.get();
            BigDecimal share;
            if (i == orderIds.size() - 1 || totalPaidAmount.compareTo(BigDecimal.ZERO) <= 0) {
                // Last order absorbs the rounding tail; if nothing weighs, dump it here.
                share = remaining;
            } else {
                share = totalTip.multiply(paidAmountByOrder.getOrDefault(orderId, BigDecimal.ZERO))
                        .divide(totalPaidAmount, 2, java.math.RoundingMode.HALF_UP);
                remaining = remaining.subtract(share);
            }
            BigDecimal existing = o.getTip() != null ? o.getTip() : BigDecimal.ZERO;
            o.setTip(existing.add(share));
            orderRepository.save(o);
            if (totalPaidAmount.compareTo(BigDecimal.ZERO) <= 0) break;
        }
    }

    /**
     * Distribute the supplied tip proportionally across the given orders by
     * their non-cancelled item totals. Called from the bulk-paid flow after
     * items have already been marked paid, so it operates on all non-cancelled
     * items (paid + unpaid) — by that point everything's paid.
     */
    private void applyTipToOrders(List<UUID> orderIds, BigDecimal totalTip) {
        if (orderIds.isEmpty() || totalTip == null || totalTip.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        List<OrderEntity> orders = new ArrayList<>(orderIds.size());
        java.util.Map<UUID, BigDecimal> amountByOrder = new java.util.HashMap<>();
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (UUID id : orderIds) {
            var opt = orderRepository.findByIdWithItems(id);
            if (opt.isEmpty()) continue;
            OrderEntity o = opt.get();
            BigDecimal amount = o.getItems().stream()
                    .filter(i -> i.getStatus() != OrderItemStatus.CANCELLED)
                    .map(i -> i.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            orders.add(o);
            amountByOrder.put(o.getId(), amount);
            totalAmount = totalAmount.add(amount);
        }
        if (orders.isEmpty()) {
            return;
        }
        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            // Nothing to weight against — dump the whole tip on the first order.
            orders.get(0).setTip(totalTip);
            orderRepository.save(orders.get(0));
            return;
        }
        BigDecimal remaining = totalTip;
        for (int i = 0; i < orders.size(); i++) {
            OrderEntity o = orders.get(i);
            BigDecimal tipForOrder;
            if (i == orders.size() - 1) {
                // Last order absorbs the rounding tail so the sum matches exactly.
                tipForOrder = remaining;
            } else {
                tipForOrder = totalTip.multiply(amountByOrder.get(o.getId()))
                        .divide(totalAmount, 2, java.math.RoundingMode.HALF_UP);
                remaining = remaining.subtract(tipForOrder);
            }
            o.setTip(tipForOrder);
            orderRepository.save(o);
        }
    }

    /**
     * Handles payment completion for all orders of a registration (guest).
     *
     * @param registrationId The registration ID
     * @return Number of items marked as paid
     */
    @Transactional
    public int handleGuestPaymentComplete(UUID registrationId) {
        return handleGuestPaymentComplete(registrationId, null, null);
    }

    /**
     * Handles payment completion for all orders of a registration (guest) with payment tracking.
     *
     * @param registrationId The registration ID
     * @param paymentMethod The payment method (CASH, CARD, or ONLINE)
     * @param paidBy Who marked the order as paid
     * @return Number of items marked as paid
     */
    @Transactional
    public int handleGuestPaymentComplete(UUID registrationId, String paymentMethod, String paidBy) {
        List<OrderEntity> orders = orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId);
        log.info("Processing guest payment for registration {}: {} orders", registrationId, orders.size());

        int totalItemsMarked = 0;
        for (OrderEntity order : orders) {
            // Reload with items
            var orderWithItems = orderRepository.findByIdWithItems(order.getId());
            if (orderWithItems.isPresent()) {
                int itemsMarked = markOrderItemsAsPaid(orderWithItems.get(), paymentMethod, paidBy);
                totalItemsMarked += itemsMarked;
            }
        }

        log.info("Guest payment complete for registration {}: {} items marked as paid", registrationId, totalItemsMarked);
        return totalItemsMarked;
    }

    /**
     * Handles payment completion for all orders at an order point.
     *
     * @param orderPointId The order point ID
     * @return Number of items marked as paid
     */
    @Transactional
    public int handleOrderPointPaymentComplete(UUID orderPointId) {
        return handleOrderPointPaymentComplete(orderPointId, null, null);
    }

    /**
     * Handles payment completion for all orders at an order point with payment tracking.
     *
     * @param orderPointId The order point ID
     * @param paymentMethod The payment method (CASH, CARD, or ONLINE)
     * @param paidBy Who marked the order as paid
     * @return Number of items marked as paid
     */
    @Transactional
    public int handleOrderPointPaymentComplete(UUID orderPointId, String paymentMethod, String paidBy) {
        List<OrderEntity> orders = orderRepository.findByOrderPointIdAndNeedsPaymentTrue(orderPointId);
        log.info("Processing order point payment for {}: {} orders", orderPointId, orders.size());

        int totalItemsMarked = 0;
        for (OrderEntity order : orders) {
            // Reload with items
            var orderWithItems = orderRepository.findByIdWithItems(order.getId());
            if (orderWithItems.isPresent()) {
                int itemsMarked = markOrderItemsAsPaid(orderWithItems.get(), paymentMethod, paidBy);
                totalItemsMarked += itemsMarked;
            }
        }

        log.info("Order point payment complete for {}: {} items marked as paid", orderPointId, totalItemsMarked);
        return totalItemsMarked;
    }

    private int markOrderItemsAsPaid(OrderEntity order) {
        return markOrderItemsAsPaid(order, null, null);
    }

    private int markOrderItemsAsPaid(OrderEntity order, String paymentMethod, String paidBy) {
        int itemsMarkedPaid = 0;

        for (var item : order.getItems()) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            if (!item.isPaid()) {
                item.setPaid(true);
                itemsMarkedPaid++;
            }
        }

        order.setNeedsPayment(false);
        if (paymentMethod != null) {
            order.setPaymentMethod(paymentMethod);
        }
        if (paidBy != null) {
            order.setPaidBy(paidBy);
        }
        if (paymentMethod != null || paidBy != null) {
            order.setPaidAt(LocalDateTime.now());
        }
        orderRepository.save(order);

        if (itemsMarkedPaid > 0) {
            notificationService.notifyPaymentCompleted(order, itemsMarkedPaid);
        }

        return itemsMarkedPaid;
    }

    /**
     * Calculates the total unpaid amount for an order.
     */
    public BigDecimal calculateOrderUnpaidAmount(UUID orderId) {
        return orderRepository.findByIdWithItems(orderId)
                .map(order -> order.getItems().stream()
                        .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                        .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                        .reduce(BigDecimal.ZERO, BigDecimal::add))
                .orElse(BigDecimal.ZERO);
    }

    /**
     * Calculates the total unpaid amount for a registration.
     */
    public BigDecimal calculateRegistrationUnpaidAmount(UUID registrationId) {
        return orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId).stream()
                .flatMap(order -> orderRepository.findByIdWithItems(order.getId())
                        .map(o -> o.getItems().stream())
                        .orElse(java.util.stream.Stream.empty()))
                .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Calculates the total unpaid amount for an order point.
     */
    public BigDecimal calculateOrderPointUnpaidAmount(UUID orderPointId) {
        return orderRepository.findByOrderPointIdAndNeedsPaymentTrue(orderPointId).stream()
                .flatMap(order -> orderRepository.findByIdWithItems(order.getId())
                        .map(o -> o.getItems().stream())
                        .orElse(java.util.stream.Stream.empty()))
                .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * Saves tip for a single order.
     */
    @Transactional
    public void saveTip(UUID orderId, BigDecimal tip) {
        orderRepository.findById(orderId).ifPresent(order -> {
            order.setTip(tip);
            orderRepository.save(order);
            log.info("Saved tip {} for order {}", tip, orderId);
        });
    }

    /**
     * Saves tip for all orders of a registration (distributes proportionally based on order totals).
     */
    @Transactional
    public void saveTipForRegistration(UUID registrationId, BigDecimal tip) {
        List<OrderEntity> orders = orderRepository.findByRegistrationIdOrderByOrderNoDesc(registrationId);
        distributeTipAcrossOrders(orders, tip);
    }

    /**
     * Saves tip for all orders at an order point (distributes proportionally based on order totals).
     */
    @Transactional
    public void saveTipForOrderPoint(UUID orderPointId, BigDecimal tip) {
        List<OrderEntity> orders = orderRepository.findByOrderPointIdAndNeedsPaymentTrue(orderPointId);
        distributeTipAcrossOrders(orders, tip);
    }

    private void distributeTipAcrossOrders(List<OrderEntity> orders, BigDecimal totalTip) {
        if (orders.isEmpty() || totalTip.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        // Calculate total amount across all orders
        BigDecimal totalAmount = orders.stream()
                .flatMap(order -> orderRepository.findByIdWithItems(order.getId())
                        .map(o -> o.getItems().stream())
                        .orElse(java.util.stream.Stream.empty()))
                .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            // If no unpaid items, just put the entire tip on the first order
            if (!orders.isEmpty()) {
                orders.get(0).setTip(totalTip);
                orderRepository.save(orders.get(0));
            }
            return;
        }

        // Distribute tip proportionally
        BigDecimal remainingTip = totalTip;
        for (int i = 0; i < orders.size(); i++) {
            OrderEntity order = orders.get(i);
            var orderWithItems = orderRepository.findByIdWithItems(order.getId());
            if (orderWithItems.isEmpty()) continue;

            BigDecimal orderAmount = orderWithItems.get().getItems().stream()
                    .filter(item -> !item.isPaid() && item.getStatus() != OrderItemStatus.CANCELLED)
                    .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal orderTip;
            if (i == orders.size() - 1) {
                // Last order gets the remaining tip to avoid rounding issues
                orderTip = remainingTip;
            } else {
                // Proportional tip based on order amount
                orderTip = totalTip.multiply(orderAmount).divide(totalAmount, 2, java.math.RoundingMode.HALF_UP);
                remainingTip = remainingTip.subtract(orderTip);
            }

            order.setTip(orderTip);
            orderRepository.save(order);
            log.info("Distributed tip {} to order {}", orderTip, order.getId());
        }
    }
}