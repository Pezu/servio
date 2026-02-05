package com.tapello.event.web;

import com.tapello.event.dto.CreateOrderPointRequest;
import com.tapello.event.dto.OrderPoint;
import com.tapello.event.dto.UpdateOrderPointRequest;
import com.tapello.event.service.OrderPointService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/order-points")
@RequiredArgsConstructor
public class OrderPointController {

    private final OrderPointService orderPointService;

    @PostMapping("/location/{locationId}")
    public ResponseEntity<OrderPoint> createOrderPoint(
            @PathVariable UUID locationId,
            @RequestBody CreateOrderPointRequest request) {
        OrderPoint response = orderPointService.createOrderPoint(locationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/location/{locationId}")
    public ResponseEntity<Page<OrderPoint>> getOrderPointsByLocationId(
            @PathVariable UUID locationId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<OrderPoint> orderPoints = orderPointService.getOrderPointsByLocationId(locationId, pageable);
        return ResponseEntity.ok(orderPoints);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderPoint> getOrderPointById(@PathVariable UUID id) {
        OrderPoint response = orderPointService.getOrderPointById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<OrderPoint> updateOrderPoint(
            @PathVariable UUID id,
            @RequestBody UpdateOrderPointRequest request) {
        OrderPoint response = orderPointService.updateOrderPoint(id, request);
        return ResponseEntity.ok(response);
    }
}