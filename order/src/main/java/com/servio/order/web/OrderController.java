package com.servio.order.web;

import com.servio.order.dto.OrderDto;
import com.servio.order.dto.ReceiveOrderRequest;
import com.servio.order.entity.OrderItemStatus;
import com.servio.order.entity.OrderStatus;
import com.servio.order.mapper.OrderMapper;
import com.servio.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderMapper orderMapper;

    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody ReceiveOrderRequest request) {
        log.info("Creating order for registration: {}", request.getRegistrationId());
        var order = orderService.createOrder(request);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<OrderDto> getOrder(@PathVariable UUID orderId) {
        var order = orderService.getOrderById(orderId);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @GetMapping("/registrations/{registrationId}")
    public ResponseEntity<List<OrderDto>> getOrdersByRegistration(@PathVariable UUID registrationId) {
        var orders = orderService.getOrdersByRegistrationId(registrationId);
        return ResponseEntity.ok(orderMapper.toDtoList(orders));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<List<OrderDto>> getOrdersByEvent(@PathVariable UUID eventId) {
        var orders = orderService.getOrdersByEventId(eventId);
        return ResponseEntity.ok(orderMapper.toDtoList(orders));
    }

    @GetMapping("/order-points/{orderPointId}")
    public ResponseEntity<List<OrderDto>> getOrdersByOrderPoint(
            @PathVariable UUID orderPointId,
            @RequestParam(required = false) List<OrderStatus> statuses) {
        List<OrderStatus> statusList = statuses != null ? statuses :
                List.of(OrderStatus.ACTIVE, OrderStatus.IN_PROGRESS, OrderStatus.READY);
        var orders = orderService.getOrdersByOrderPointId(orderPointId, statusList);
        return ResponseEntity.ok(orderMapper.toDtoList(orders));
    }

    @PostMapping("/{orderId}/confirm")
    public ResponseEntity<OrderDto> confirmOrder(@PathVariable UUID orderId) {
        log.info("Confirming order: {}", orderId);
        var order = orderService.confirmOrder(orderId);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @PostMapping("/{orderId}/complete")
    public ResponseEntity<OrderDto> completeOrder(@PathVariable UUID orderId) {
        log.info("Completing order: {}", orderId);
        var order = orderService.completeOrder(orderId);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<OrderDto> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestParam OrderStatus status,
            @RequestParam(required = false) String user) {
        log.info("Updating order {} status to {} by user {}", orderId, status, user);
        var order = orderService.updateOrderStatus(orderId, status, user);
        return ResponseEntity.ok(orderMapper.toDto(order));
    }

    @PutMapping("/items/{itemId}/status")
    public ResponseEntity<Void> updateOrderItemStatus(
            @PathVariable UUID itemId,
            @RequestParam OrderItemStatus status) {
        log.info("Updating order item {} status to {}", itemId, status);
        orderService.updateOrderItemStatus(itemId, status);
        return ResponseEntity.ok().build();
    }
}
