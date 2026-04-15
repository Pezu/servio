package com.servio.order.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.servio.order.event.OrderCreatedEvent;
import com.servio.order.event.OrderItemStatusChangedEvent;
import com.servio.order.event.OrderStatusChangedEvent;
import com.servio.order.event.PaymentCompletedEvent;
import io.awspring.cloud.sqs.operations.SqsTemplate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SqsProducerService {

    private final SqsTemplate sqsTemplate;
    private final ObjectMapper objectMapper;

    @Value("${sqs.queues.order-created}")
    private String orderCreatedQueue;

    @Value("${sqs.queues.order-status-changed}")
    private String orderStatusChangedQueue;

    @Value("${sqs.queues.order-item-status-changed}")
    private String orderItemStatusChangedQueue;

    @Value("${sqs.queues.payment-completed}")
    private String paymentCompletedQueue;

    public void publishOrderCreated(OrderCreatedEvent event) {
        log.info("Publishing order created event for orderId: {}", event.getOrderId());
        publishToSqs(orderCreatedQueue, event);
    }

    public void publishOrderStatusChanged(OrderStatusChangedEvent event) {
        log.info("Publishing order status changed event for orderId: {} from {} to {}",
                event.getOrderId(), event.getPreviousStatus(), event.getNewStatus());
        publishToSqs(orderStatusChangedQueue, event);
    }

    public void publishOrderItemStatusChanged(OrderItemStatusChangedEvent event) {
        log.info("Publishing order item status changed event for itemId: {} from {} to {}",
                event.getItemId(), event.getPreviousStatus(), event.getNewStatus());
        publishToSqs(orderItemStatusChangedQueue, event);
    }

    public void publishPaymentCompleted(PaymentCompletedEvent event) {
        log.info("Publishing payment completed event for reference: {}", event.getPaymentReference());
        publishToSqs(paymentCompletedQueue, event);
    }

    private void publishToSqs(String queueName, Object event) {
        try {
            String message = objectMapper.writeValueAsString(event);
            log.info("Publishing to SQS queue {}: {}", queueName, message);
            sqsTemplate.send(queueName, message);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize event for SQS queue {}: {}", queueName, e.getMessage());
            throw new RuntimeException("Failed to serialize event", e);
        }
    }
}
