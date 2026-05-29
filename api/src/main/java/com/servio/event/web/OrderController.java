package com.servio.event.web;

import com.servio.event.dto.BulkMarkPaidRequest;
import com.servio.event.dto.CashRegisterReceiptRequest;
import com.servio.event.dto.CashRegisterReceiptResponse;
import com.servio.event.dto.MarkPaidRequest;
import com.servio.event.dto.ProtocolPaymentSummary;
import com.servio.event.service.ProtocolPaymentService;
import com.servio.event.dto.Order;
import com.servio.event.dto.OrderItem;
import com.servio.event.dto.ReceiveOrderRequest;
import com.servio.event.entity.OrderItemStatus;
import com.servio.event.entity.OrderStatus;
import com.servio.event.entity.OrderEntity;
import com.servio.event.mapper.OrderMapper;
import com.servio.event.service.CashRegisterService;
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
    private final CashRegisterService cashRegisterService;
    private final ProtocolPaymentService protocolPaymentService;

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
            @RequestParam(required = false) LocalDateTime endDate,
            @RequestParam(required = false) UUID eventId) {
        Page<OrderEntity> orders;
        if (eventId != null && startDate != null && endDate != null) {
            orders = orderService.getOrdersByEventIdAndDateRange(eventId, startDate, endDate, pageable);
        } else if (eventId != null) {
            orders = orderService.getOrdersByEventIdPaged(eventId, pageable);
        } else if (startDate != null && endDate != null) {
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

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> deleteOrderItem(@PathVariable UUID itemId) {
        OrderEntity order = orderService.deleteOrderItem(itemId);
        // Re-broadcast the surviving order so connected dashboards refresh.
        Order dto = orderDtoEnricher.enrich(orderMapper.toDto(order), order);
        messagingTemplate.convertAndSend("/topic/event/" + order.getEventId() + "/orders", dto);
        return ResponseEntity.noContent().build();
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

    /**
     * Updates every non-terminal order in a group atomically. The kanban "table card"
     * uses this so dragging a card with N orders to a new column produces a single
     * commit + a single broadcast — not N interleaved transactions that flash a
     * half-moved group on the dashboard.
     */
    @PatchMapping("/groups/{groupId}/status")
    public ResponseEntity<List<Order>> updateGroupStatus(
            @PathVariable UUID groupId,
            @RequestParam OrderStatus status,
            @RequestParam(required = false) String user) {
        var orders = orderService.updateGroupStatus(groupId, status, user);
        messagingTemplate.convertAndSend("/topic/orders", "group-updated");
        var dtos = orderMapper.toDtoList(orders);
        return ResponseEntity.ok(orderDtoEnricher.enrichBatch(dtos, orders));
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

    /**
     * Forwards the selected orders to the (mock) fiscal cash register and returns
     * the device's response — receipt number, fiscal id, status. Real integration
     * will replace the mock inside CashRegisterService.printReceipt.
     */
    @PostMapping("/cash-register/receipt")
    public ResponseEntity<CashRegisterReceiptResponse> printCashRegisterReceipt(
            @RequestBody CashRegisterReceiptRequest request) {
        return ResponseEntity.ok(cashRegisterService.printReceipt(request));
    }

    /**
     * Lists PROTOCOL-paid orders for the event — feeds the mobile Approvals
     * tab. Each row carries the paying user, total amount, order point and the
     * client name configured in Edit Event → Order Points.
     */
    @GetMapping("/events/{eventId}/protocol-payments")
    public ResponseEntity<List<ProtocolPaymentSummary>> listProtocolPayments(@PathVariable UUID eventId) {
        return ResponseEntity.ok(protocolPaymentService.listForEvent(eventId));
    }

    /**
     * Backoffice Collect modal: mark a batch of orders paid in one shot. After
     * the transaction commits, the listener fires once and routes a single
     * fiscal receipt to the per-OP cash register (mirrors the Netopia path).
     */
    @PostMapping("/bulk-paid")
    public ResponseEntity<Void> bulkMarkPaid(@RequestBody BulkMarkPaidRequest request) {
        int marked = orderService.markOrdersPaidBulk(
                request.getOrderIds(),
                request.getPaymentMethod(),
                request.getPaidBy(),
                request.getCashRegisterDeviceId(),
                request.getTip());
        log.info("Bulk-marked {} items as paid across {} order(s) via {} by {}",
                marked,
                request.getOrderIds() != null ? request.getOrderIds().size() : 0,
                request.getPaymentMethod(),
                request.getPaidBy());
        return ResponseEntity.noContent().build();
    }
}