package com.tapello.event.listener;

import com.tapello.event.entity.OrderItemEntity;
import com.tapello.event.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderItemCancelListener {

    private final OrderItemRepository orderItemRepository;

    @KafkaListener(
            topics = "${kafka.order.item.cancel.topic}",
            groupId = "${kafka.order.item.cancel.group}"
    )
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
