package com.servio.event.web;

import com.servio.event.dto.MarkPaidRequest;
import com.servio.event.dto.Order;
import com.servio.event.dto.OrderItem;
import com.servio.event.dto.ReceiveOrderRequest;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import com.servio.event.entity.OrderEntity;
import com.servio.event.mapper.OrderMapper;
import com.servio.event.service.OrderDtoEnricher;
import com.servio.event.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final SimpMessagingTemplate messagingTemplate;
    private final OrderService orderService;
    private final OrderMapper orderMapper;
    private final OrderDtoEnricher orderDtoEnricher;

    @PostMapping
    public ResponseEntity<Order> receiveOrder(@Valid @RequestBody ReceiveOrderRequest request) {
        OrderEntity order = orderService.createOrder(request);

        Order orderDto = orderDtoEnricher.enrich(orderMapper.toDto(order), order);
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
        return ResponseEntity.ok(orders.map(entity -> orderDtoEnricher.enrich(orderMapper.toDto(entity), entity)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<Order> getOrderById(@PathVariable UUID orderId) {
        OrderEntity order = orderService.getOrderById(orderId);
        return ResponseEntity.ok(orderDtoEnricher.enrich(orderMapper.toDto(order), order));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<List<Order>> getOrdersByEvent(@PathVariable UUID eventId) {
        List<OrderEntity> orders = orderService.getOrdersByEventId(eventId);
        List<Order> dtos = orderMapper.toDtoList(orders);
        return ResponseEntity.ok(orderDtoEnricher.enrichBatch(dtos, orders));
    }

    @GetMapping("/events/{eventId}/needs-payment")
    public ResponseEntity<List<Order>> getOrdersNeedingPayment(@PathVariable UUID eventId) {
        List<OrderEntity> orders = orderService.getOrdersNeedingPayment(eventId);
        List<Order> dtos = orderMapper.toDtoList(orders);
        return ResponseEntity.ok(orderDtoEnricher.enrichBatch(dtos, orders));
    }

    @GetMapping("/registrations/{registrationId}")
    public ResponseEntity<List<Order>> getOrdersByRegistration(@PathVariable UUID registrationId) {
        List<OrderEntity> orders = orderService.getOrdersByRegistrationId(registrationId);
        List<Order> dtos = orderMapper.toDtoList(orders);
        return ResponseEntity.ok(orderDtoEnricher.enrichBatch(dtos, orders));
    }

    @GetMapping("/order-points/{orderPointId}")
    public ResponseEntity<List<Order>> getOrdersByOrderPoint(
            @PathVariable UUID orderPointId,
            @RequestParam UUID registrationId) {
        List<OrderEntity> orders = orderService.getOrdersByOrderPointIdForRegistration(orderPointId, registrationId);
        List<Order> dtos = orderMapper.toDtoList(orders);
        return ResponseEntity.ok(orderDtoEnricher.enrichBatch(dtos, orders));
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
        return ResponseEntity.ok(orderDtoEnricher.enrich(orderMapper.toDto(order), order));
    }

    @PatchMapping("/{orderId}/complete")
    public ResponseEntity<Order> completeOrder(@PathVariable UUID orderId) {
        var order = orderService.completeOrder(orderId);
        messagingTemplate.convertAndSend("/topic/orders", "order-completed");
        return ResponseEntity.ok(orderDtoEnricher.enrich(orderMapper.toDto(order), order));
    }

    @PostMapping("/{orderId}/confirm")
    public ResponseEntity<Order> confirmOrder(@PathVariable UUID orderId) {
        var order = orderService.confirmOrder(orderId);
        Order orderDto = orderDtoEnricher.enrich(orderMapper.toDto(order), order);
        messagingTemplate.convertAndSend("/topic/orders", orderDto);
        return ResponseEntity.ok(orderDto);
    }

    /**
     * Manually mark an order as paid.
     * Used by backoffice staff when receiving cash payment.
     */
    @PatchMapping("/{orderId}/paid")
    public ResponseEntity<Order> markOrderPaid(
            @PathVariable UUID orderId,
            @RequestBody(required = false) MarkPaidRequest request) {
        String paymentMethod = request != null ? request.getPaymentMethod() : null;
        String paidBy = request != null ? request.getPaidBy() : null;
        int itemsMarked = orderService.handlePaymentComplete(orderId, paymentMethod, paidBy);
        log.info("Marked {} items as paid for order {} via {} by {}", itemsMarked, orderId, paymentMethod, paidBy);
        var order = orderService.getOrderById(orderId);
        return ResponseEntity.ok(orderDtoEnricher.enrich(orderMapper.toDto(order), order));
    }
}