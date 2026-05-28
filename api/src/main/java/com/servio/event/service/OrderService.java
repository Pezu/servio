package com.servio.event.service;

import com.servio.event.dto.ReceiveOrderRequest;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderGroupEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationOrderPointEntity;
import com.servio.event.event.PaymentCompletedEvent;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderMapper;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.MenuItemRepository;
import com.servio.event.repository.OrderGroupRepository;
import com.servio.event.repository.OrderItemRepository;
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
    private final OrderGroupRepository orderGroupRepository;
    private final RegistrationRepository registrationRepository;
    private final RegistrationOrderPointRepository registrationOrderPointRepository;
    private final EventRepository eventRepository;
    private final MenuItemRepository menuItemRepository;
    private final OrderNotificationService notificationService;
    private final OrderMapper orderMapper;
    private final ApplicationEventPublisher eventPublisher;

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
        var orderOpt = orderRepository.findByIdWithItems(orderId);
        if (orderOpt.isEmpty()) {
            log.warn("Order not found for payment completion: {}", orderId);
            return 0;
        }

        OrderEntity order = orderOpt.get();
        int itemsMarkedPaid = 0;

        log.info("Processing payment completion for order {} with {} items", orderId, order.getItems().size());

        for (var item : order.getItems()) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            if (!item.isPaid()) {
                item.setPaid(true);
                itemsMarkedPaid++;
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
        if (orderIds == null || orderIds.isEmpty()) {
            return 0;
        }
        int totalItemsMarked = 0;
        List<UUID> processed = new ArrayList<>(orderIds.size());
        for (UUID orderId : orderIds) {
            int marked = handlePaymentComplete(orderId, paymentMethod, paidBy);
            totalItemsMarked += marked;
            processed.add(orderId);
        }
        if (paymentMethod != null) {
            eventPublisher.publishEvent(new PaymentCompletedEvent(processed, paymentMethod, cashRegisterDeviceId, paidBy));
        }
        return totalItemsMarked;
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