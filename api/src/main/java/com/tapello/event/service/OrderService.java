package com.tapello.event.service;

import com.tapello.event.dto.ReceiveOrderRequest;
import com.tapello.event.entity.EventEntity;
import com.tapello.event.entity.OrderEntity;
import com.tapello.event.entity.OrderItemEntity;
import com.tapello.event.entity.OrderItemStatus;
import com.tapello.event.entity.OrderStatus;
import com.tapello.event.entity.RegistrationEntity;
import com.tapello.event.repository.EventRepository;
import com.tapello.event.repository.OrderItemRepository;
import com.tapello.event.repository.OrderRepository;
import com.tapello.event.repository.RegistrationRepository;
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

    @Transactional
    public OrderEntity createOrder(ReceiveOrderRequest request) {
        RegistrationEntity registration = registrationRepository.findById(request.getRegistrationId())
                .orElseThrow(() -> new RuntimeException("Registration not found"));

        EventEntity event = registration.getEvent();
        event.setLastOrderNo(event.getLastOrderNo() + 1);
        eventRepository.save(event);

        OrderEntity order = new OrderEntity();
        order.setRegistrationId(request.getRegistrationId());
        order.setEventId(event.getId());
        order.setOrderPointId(request.getOrderPointId());
        order.setOrderNo(event.getLastOrderNo());
        order.setStatus(OrderStatus.DRAFT);
        order.setNote(request.getNote());

        request.getOrderItems().forEach(item -> {
            OrderItemEntity orderItem = new OrderItemEntity();
            orderItem.setName(item.getName());
            orderItem.setPrice(item.getPrice());
            orderItem.setQuantity(item.getQuantity());
            orderItem.setNote(item.getNote());
            order.addItem(orderItem);
        });

        return orderRepository.save(order);
    }

    public List<OrderEntity> getOrdersByEventId(UUID eventId) {
        return orderRepository.findByEventIdAndStatusNotIn(eventId, List.of(OrderStatus.DRAFT, OrderStatus.DELIVERED, OrderStatus.CANCELLED));
    }

    @Transactional
    public OrderEntity confirmOrder(UUID orderId) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if (order.getStatus() != OrderStatus.DRAFT) {
            throw new RuntimeException("Order is not in DRAFT status");
        }

        order.setStatus(OrderStatus.ACTIVE);
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
                .orElseThrow(() -> new RuntimeException("Order not found"));
    }

    @Transactional
    public OrderItemEntity updateOrderItemStatus(UUID orderItemId, OrderItemStatus status) {
        OrderItemEntity orderItem = orderItemRepository.findById(orderItemId)
                .orElseThrow(() -> new RuntimeException("Order item not found"));

        OrderItemStatus previousItemStatus = orderItem.getStatus();
        orderItem.setStatus(status);
        orderItemRepository.save(orderItem);

        if (status == OrderItemStatus.CANCELLED) {
            kafkaTemplate.send(cancelOrderItemTopic, orderItemId.toString());
        }

        // Notify item status change
        notificationService.notifyItemStatusChange(orderItem, previousItemStatus, status);

        // Update order status based on item statuses
        OrderEntity order = orderItem.getOrder();
        updateOrderStatusBasedOnItems(order);

        return orderItem;
    }

    private void updateOrderStatusBasedOnItems(OrderEntity order) {
        OrderStatus previousOrderStatus = order.getStatus();

        // Check if all items are CANCELLED
        boolean allItemsCancelled = order.getItems().stream()
                .allMatch(item -> item.getStatus() == OrderItemStatus.CANCELLED);

        if (allItemsCancelled) {
            order.setStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);
            notificationService.notifyOrderStatusChange(order, previousOrderStatus, OrderStatus.CANCELLED);
            return;
        }

        // Check if all items are DONE or CANCELLED
        boolean allItemsComplete = order.getItems().stream()
                .allMatch(item -> item.getStatus() == OrderItemStatus.DONE || item.getStatus() == OrderItemStatus.CANCELLED);

        if (allItemsComplete && order.getStatus() == OrderStatus.IN_PROGRESS) {
            order.setStatus(OrderStatus.READY);
            orderRepository.save(order);
            notificationService.notifyOrderStatusChange(order, previousOrderStatus, OrderStatus.READY);
        }
    }

    @Transactional
    public OrderEntity updateOrderStatus(UUID orderId, OrderStatus status, String user) {
        OrderEntity order = orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        OrderStatus previousStatus = order.getStatus();

        // If returning to ACTIVE, reset all items to ORDERED and clear assigned user
        if (status == OrderStatus.ACTIVE) {
            order.getItems().forEach(item -> item.setStatus(OrderItemStatus.ORDERED));
            order.setAssignedUser(null);
        }

        order.setStatus(status);
        if (user != null) {
            order.setAssignedUser(user);
        }

        OrderEntity savedOrder = orderRepository.save(order);
        notificationService.notifyOrderStatusChange(savedOrder, previousStatus, status);

        return savedOrder;
    }
}