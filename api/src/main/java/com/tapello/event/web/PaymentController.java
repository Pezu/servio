package com.tapello.event.web;

import com.tapello.event.dto.StartPaymentResponse;
import com.tapello.event.service.NetopiaPaymentService;
import com.tapello.event.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final NetopiaPaymentService netopiaPaymentService;

    @PostMapping("/create-order")
    public ResponseEntity<Map<String, Object>> createOrder(@RequestBody CreateOrderRequest request) {
        Map<String, Object> order = paymentService.createOrder(
                request.amount(),
                request.currency(),
                request.description()
        );
        return ResponseEntity.ok(order);
    }

    @PostMapping("/netopia/start")
    public ResponseEntity<StartPaymentResponse> startNetopiaPayment(@RequestBody NetopiaPaymentRequest request) {
        StartPaymentResponse response = netopiaPaymentService.startPayment(
                request.orderId(),
                request.amount()
        );
        return ResponseEntity.ok(response);
    }

    public record CreateOrderRequest(int amount, String currency, String description) {}
    public record NetopiaPaymentRequest(String orderId, Double amount) {}
}