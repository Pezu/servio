package com.servio.order.service;

import com.servio.order.client.EventApiClient;
import com.servio.order.dto.ReceiveOrderRequest;
import com.servio.order.entity.OrderEntity;
import com.servio.order.entity.OrderItemEntity;
import com.servio.order.entity.OrderItemStatus;
import com.servio.order.entity.OrderStatus;
import com.servio.order.event.OrderCreatedEvent;
import com.servio.order.event.OrderItemStatusChangedEvent;
import com.servio.order.event.OrderStatusChangedEvent;
import com.servio.order.exception.BusinessException;
import com.servio.order.exception.ResourceNotFoundException;
import com.servio.order.mapper.OrderMapper;
import com.servio.order.repository.OrderItemRepository;
import com.servio.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final EventApiClient eventApiClient;
    private final KafkaProducerService kafkaProducerService;
    private final OrderMapper orderMapper;

    @Transactional
    public OrderEntity createOrder(ReceiveOrderRequest request) {
        // Get event ID and nickname from the Event API
        UUID eventId = eventApiClient.getEventIdByRegistrationId(request.getRegistrationId());
        String nickname = eventApiClient.getNicknameByRegistrationId(request.getRegistrationId());

        // Atomically increment and get the next order number
        Integer nextOrderNo = eventApiClient.incrementAndGetOrderNo(eventId);

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
        log.info("Creating order: request.nickname='{}', registration.nickname='{}'",
                request.getNickname(), nickname);
        if (nickname != null) {
            order.setNickname(nickname);
        }

        // Create order items
        request.getOrderItems().stream()
                .map(orderMapper::toEntity)
                .forEach(order::addItem);

        OrderEntity savedOrder = orderRepository.save(order);

        // Publish Kafka event
        publishOrderCreatedEvent(savedOrder);

        return savedOrder;
    }

    private void publishOrderCreatedEvent(OrderEntity order) {
        BigDecimal totalAmount = order.getItems().stream()
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<OrderCreatedEvent.OrderItemEvent> itemEvents = order.getItems().stream()
                .map(item -> OrderCreatedEvent.OrderItemEvent.builder()
                        .itemId(item.getId())
                        .name(item.getName())
                        .price(item.getPrice())
                        .quantity(item.getQuantity())
                        .status(item.getStatus().name())
                        .build())
                .collect(Collectors.toList());

        OrderCreatedEvent event = OrderCreatedEvent.builder()
                .orderId(order.getId())
                .registrationId(order.getRegistrationId())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .orderNo(order.getOrderNo())
                .status(order.getStatus().name())
                .nickname(order.getNickname())
                .needsPayment(order.isNeedsPayment())
                .totalAmount(totalAmount)
                .items(itemEvents)
                .createdAt(order.getCreatedAt())
                .build();

        kafkaProducerService.publishOrderCreated(event);
    }

    public List<OrderEntity> getOrdersByEventId(UUID eventId) {
        return orderRepository.findByEventIdOrderByCreatedAtDesc(eventId);
    }

    public List<OrderEntity> getOrdersByRegistrationId(UUID registrationId) {
        return orderRepository.findByRegistrationIdOrderByCreatedAtDesc(registrationId);
    }

    public List<OrderEntity> getOrdersByOrderPointId(UUID orderPointId, List<OrderStatus> statuses) {
        return orderRepository.findByOrderPointIdAndStatusInWithItems(orderPointId, statuses);
    }

    public OrderEntity getOrderById(UUID orderId) {
        return orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));
    }

    @Transactional
    public OrderEntity confirmOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        if (order.getStatus() != OrderStatus.DRAFT) {
            throw new BusinessException("Order is not in DRAFT status");
        }

        OrderStatus previousStatus = order.getStatus();
        order.setStatus(OrderStatus.ACTIVE);

        // Mark all items as paid since this is a "pay now" order that has been paid
        order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED)
                .forEach(item -> item.setPaid(true));

        OrderEntity savedOrder = orderRepository.save(order);

        // Publish status change event
        publishOrderStatusChangedEvent(savedOrder, previousStatus, OrderStatus.ACTIVE);

        return savedOrder;
    }

    @Transactional
    public OrderItemEntity updateOrderItemStatus(UUID orderItemId, OrderItemStatus status) {
        OrderItemEntity orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new ResourceNotFoundException("OrderItem", orderItemId));

        OrderItemStatus previousItemStatus = orderItem.getStatus();
        orderItem.setStatus(status);
        orderItemRepository.save(orderItem);

        // Publish item status change event
        publishOrderItemStatusChangedEvent(orderItem, previousItemStatus, status);

        // Update order status based on items
        updateOrderStatusBasedOnItems(orderItem.getOrder());

        return orderItem;
    }

    private void publishOrderItemStatusChangedEvent(OrderItemEntity item, OrderItemStatus previousStatus, OrderItemStatus newStatus) {
        OrderEntity order = item.getOrder();
        OrderItemStatusChangedEvent event = OrderItemStatusChangedEvent.builder()
                .itemId(item.getId())
                .orderId(order.getId())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .orderNo(order.getOrderNo())
                .itemName(item.getName())
                .previousStatus(previousStatus.name())
                .newStatus(newStatus.name())
                .changedAt(LocalDateTime.now())
                .build();

        kafkaProducerService.publishOrderItemStatusChanged(event);
    }

    private void updateOrderStatusBasedOnItems(OrderEntity order) {
        OrderStatus previousOrderStatus = order.getStatus();

        determineNewOrderStatus(order)
                .filter(newStatus -> newStatus != previousOrderStatus)
                .ifPresent(newStatus -> {
                    order.setStatus(newStatus);
                    orderRepository.save(order);
                    publishOrderStatusChangedEvent(order, previousOrderStatus, newStatus);
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

    @Transactional
    public OrderEntity completeOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order", orderId));

        OrderStatus previousStatus = order.getStatus();

        // Mark all non-cancelled, non-done items as DONE
        order.getItems().stream()
                .filter(item -> item.getStatus() != OrderItemStatus.CANCELLED && item.getStatus() != OrderItemStatus.DONE)
                .forEach(item -> item.setStatus(OrderItemStatus.DONE));

        order.setStatus(OrderStatus.READY);

        OrderEntity savedOrder = orderRepository.save(order);
        publishOrderStatusChangedEvent(savedOrder, previousStatus, OrderStatus.READY);

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
        publishOrderStatusChangedEvent(savedOrder, previousStatus, status);

        return savedOrder;
    }

    private void publishOrderStatusChangedEvent(OrderEntity order, OrderStatus previousStatus, OrderStatus newStatus) {
        OrderStatusChangedEvent event = OrderStatusChangedEvent.builder()
                .orderId(order.getId())
                .eventId(order.getEventId())
                .orderPointId(order.getOrderPointId())
                .registrationId(order.getRegistrationId())
                .orderNo(order.getOrderNo())
                .previousStatus(previousStatus.name())
                .newStatus(newStatus.name())
                .assignedUser(order.getAssignedUser())
                .changedAt(LocalDateTime.now())
                .build();

        kafkaProducerService.publishOrderStatusChanged(event);
    }
}
