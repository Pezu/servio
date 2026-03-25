package com.servio.event.service;

import com.servio.event.dto.ReceiveOrderRequest;
import com.servio.event.entity.OrderEntity;
import com.servio.event.entity.OrderItemEntity;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.OrderMapper;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderItemRepository;
import com.servio.event.repository.OrderRepository;
import com.servio.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    @Value("${kafka.order.item.cancel.topic}")
    private String cancelOrderItemTopic;

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final RegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final OrderNotificationService notificationService;
    private final OrderMapper orderMapper;

    @Transactional
    public OrderEntity createOrder(ReceiveOrderRequest request) {
        RegistrationEntity registration = registrationRepository.findById(request.getRegistrationId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration", request.getRegistrationId()));

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

        // Copy nickname from registration to order
        log.info("Creating order: registration.nickname='{}', order.nickname before='{}'",
                registration.getNickname(), order.getNickname());
        if (registration.getNickname() != null) {
            order.setNickname(registration.getNickname());
            log.info("Set order.nickname to '{}'", order.getNickname());
        }

        // Use functional approach with MapStruct for creating order items
        request.getOrderItems().stream()
                .map(orderMapper::toEntity)
                .forEach(order::addItem);

        OrderEntity savedOrder = orderRepository.save(order);

        // Notify via Kafka for gateway WebSocket relay
        notificationService.notifyOrderCreated(savedOrder);

        return savedOrder;
    }

    public List<OrderEntity> getOrdersByEventId(UUID eventId) {
        return orderRepository.findByEventIdAndStatusNotIn(eventId, List.of(OrderStatus.DRAFT, OrderStatus.DELIVERED, OrderStatus.CANCELLED));
    }

    public List<OrderEntity> getOrdersNeedingPayment(UUID eventId) {
        return orderRepository.findByEventIdAndNeedsPaymentTrue(eventId);
    }

    public List<OrderEntity> getOrdersByOrderPointIdForRegistration(UUID orderPointId, UUID registrationId) {
        // Validate that the registration belongs to this order point
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        if (!orderPointId.equals(registration.getOrderPoint().getId())) {
            throw new BusinessException("Registration does not belong to this order point");
        }

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

        // Mark all items as paid since this is a "pay now" order that has been paid
        order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .forEach(item -> item.setPaid(true));

        return orderRepository.save(order);
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

        // Send cancellation event if item was cancelled
        if (status == OrderItemStatus.CANCELLED) {
            kafkaTemplate.send(cancelOrderItemTopic, orderItemId.toString());
        }

        notificationService.notifyItemStatusChange(orderItem, previousItemStatus, status);
        updateOrderStatusBasedOnItems(orderItem.getOrder());

        return orderItem;
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

        boolean allItemsComplete = order.getItems().stream()
                .allMatch(item -> item.getStatus() == OrderItemStatus.DONE || item.getStatus() == OrderItemStatus.CANCELLED);

        if (allItemsComplete && order.getStatus() == OrderStatus.IN_PROGRESS) {
            return Optional.of(OrderStatus.READY);
        }

        return Optional.empty();
    }

    /**
     * Completes an order by marking all non-cancelled items as DONE and transitioning to READY.
     * This is done in a single transaction for efficiency.
     */
    @Transactional
    public OrderEntity completeOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        OrderStatus previousStatus = order.getStatus();

        // Mark all non-cancelled, non-done items as DONE
        order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED && item.getStatus() != OrderItemStatus.DONE)
                .forEach(item -> item.setStatus(OrderItemStatus.DONE));

        // Set order status to READY
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

        // If returning to ACTIVE, reset all items to ORDERED and clear assigned user
        if (status == OrderStatus.ACTIVE) {
            order.getItems().forEach(item -> item.setStatus(OrderItemStatus.ORDERED));
            order.setAssignedUser(null);
        }

        order.setStatus(status);
        Optional.ofNullable(user).ifPresent(order::setAssignedUser);

        OrderEntity savedOrder = orderRepository.save(order);
        notificationService.notifyOrderStatusChange(savedOrder, previousStatus, status);

        return savedOrder;
    }
}