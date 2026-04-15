package com.servio.event.listener;

import com.servio.event.entity.OrderItemEntity;
import com.servio.event.repository.OrderItemRepository;
import io.awspring.cloud.sqs.annotation.SqsListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderItemCancelListener {

    private final OrderItemRepository orderItemRepository;

    @SqsListener("${sqs.queues.order-item-cancel}")
    public void handleOrderItemCancel(String orderItemId) {
        OrderItemEntity orderItem = orderItemRepository.findById(UUID.fromString(orderItemId))
                .orElse(null);

        if (orderItem != null) {
            log.info("Order item cancelled: id={}, name={}, orderId={}",
                    orderItemId, orderItem.getName(), orderItem.getOrder().getId());
        } else {
            log.warn("Order item cancel event received for unknown item: id={}", orderItemId);
        }
    }
}
