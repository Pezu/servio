package com.tapello.event.web;

import com.tapello.event.dto.Order;
import com.tapello.event.dto.OrderItem;
import com.tapello.event.dto.ReceiveOrderRequest;
import com.tapello.event.entity.OrderItemStatus;
import com.tapello.event.entity.OrderStatus;
import com.tapello.event.entity.OrderEntity;
import com.tapello.event.mapper.OrderMapper;
import com.tapello.event.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final SimpMessagingTemplate messagingTemplate;
    private final OrderService orderService;
    private final OrderMapper orderMapper;

    @PostMapping
    public ResponseEntity<Order> receiveOrder(@RequestBody ReceiveOrderRequest request) {
        OrderEntity order = orderService.createOrder(request);

        Order orderDto = orderMapper.toDto(order);
        messagingTemplate.convertAndSend("/topic/orders", orderDto);

        return ResponseEntity.ok(orderDto);
    }

    @GetMapping
    public ResponseEntity<Page<Order>> getAllOrders(
            @PageableDefault(size = 20, sort = "orderNo") Pageable pageable,
            @RequestParam(required = false) LocalDateTime startDate,
            @RequestParam(required = false) LocalDateTime endDate) {
        Page<OrderEntity> orders;
        if (startDate != null && endDate != null) {
            orders = orderService.getOrdersByDateRange(startDate, endDate, pageable);
        } else {
            orders = orderService.getAllOrders(pageable);
        }
        return ResponseEntity.ok(orders.map(orderMapper::toDto));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrderById(@PathVariable UUID orderId) {
        OrderEntity order = orderService.getOrderById(orderId);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<List<Order>> getOrdersByEvent(@PathVariable UUID eventId) {
        List<OrderEntity> orders = orderService.getOrdersByEventId(eventId);
        return ResponseEntity.ok(orderMapper.toDtoList(orders));
    }

    @GetMapping("/registrations/{registrationId}")
    public ResponseEntity<List<Order>> getOrdersByRegistration(@PathVariable UUID registrationId) {
        List<OrderEntity> orders = orderService.getOrdersByRegistrationId(registrationId);
        return ResponseEntity.ok(orderMapper.toDtoList(orders));
    }

    @PatchMapping("/items/{itemId}/status")
    public ResponseEntity<OrderItem> updateOrderItemStatus(
            @PathVariable UUID itemId,
            @RequestParam OrderItemStatus status) {
        var orderItem = orderService.updateOrderItemStatus(itemId, status);
        messagingTemplate.convertAndSend("/topic/orders", "item-updated");
        return ResponseEntity.ok(orderMapper.toDto(orderItem));
    }

    @PatchMapping("/{orderId}/status")
    public ResponseEntity<Order> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestParam OrderStatus status,
            @RequestParam(required = false) String user) {
        var order = orderService.updateOrderStatus(orderId, status, user);
        messagingTemplate.convertAndSend("/topic/orders", "order-updated");
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @PostMapping("/{orderId}/confirm")
    public ResponseEntity<Order> confirmOrder(@PathVariable UUID orderId) {
        var order = orderService.confirmOrder(orderId);
        Order orderDto = orderMapper.toDto(order);
        messagingTemplate.convertAndSend("/topic/orders", orderDto);
        return ResponseEntity.ok(orderDto);
    }
}