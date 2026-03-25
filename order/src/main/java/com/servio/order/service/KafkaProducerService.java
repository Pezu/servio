package com.servio.order.service;

import com.servio.order.event.OrderCreatedEvent;
import com.servio.order.event.OrderItemStatusChangedEvent;
import com.servio.order.event.OrderStatusChangedEvent;
import com.servio.order.event.PaymentCompletedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class KafkaProducerService {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${kafka.topics.order-created}")
    private String orderCreatedTopic;

    @Value("${kafka.topics.order-status-changed}")
    private String orderStatusChangedTopic;

    @Value("${kafka.topics.order-item-status-changed}")
    private String orderItemStatusChangedTopic;

    @Value("${kafka.topics.payment-completed}")
    private String paymentCompletedTopic;

    public void publishOrderCreated(OrderCreatedEvent event) {
        log.info("Publishing order created event for orderId: {}", event.getOrderId());
        kafkaTemplate.send(orderCreatedTopic, event.getOrderId().toString(), event);
    }

    public void publishOrderStatusChanged(OrderStatusChangedEvent event) {
        log.info("Publishing order status changed event for orderId: {} from {} to {}",
                event.getOrderId(), event.getPreviousStatus(), event.getNewStatus());
        kafkaTemplate.send(orderStatusChangedTopic, event.getOrderId().toString(), event);
    }

    public void publishOrderItemStatusChanged(OrderItemStatusChangedEvent event) {
        log.info("Publishing order item status changed event for itemId: {} from {} to {}",
                event.getItemId(), event.getPreviousStatus(), event.getNewStatus());
        kafkaTemplate.send(orderItemStatusChangedTopic, event.getItemId().toString(), event);
    }

    public void publishPaymentCompleted(PaymentCompletedEvent event) {
        log.info("Publishing payment completed event for reference: {}", event.getPaymentReference());
        kafkaTemplate.send(paymentCompletedTopic, event.getPaymentReference(), event);
    }
}
