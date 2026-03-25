package com.servio.order.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Value("${kafka.topics.order-created}")
    private String orderCreatedTopic;

    @Value("${kafka.topics.order-status-changed}")
    private String orderStatusChangedTopic;

    @Value("${kafka.topics.order-item-status-changed}")
    private String orderItemStatusChangedTopic;

    @Value("${kafka.topics.payment-required}")
    private String paymentRequiredTopic;

    @Value("${kafka.topics.payment-completed}")
    private String paymentCompletedTopic;

    @Bean
    public NewTopic orderCreatedTopic() {
        return TopicBuilder.name(orderCreatedTopic)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic orderStatusChangedTopic() {
        return TopicBuilder.name(orderStatusChangedTopic)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic orderItemStatusChangedTopic() {
        return TopicBuilder.name(orderItemStatusChangedTopic)
                .partitions(6)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic paymentRequiredTopic() {
        return TopicBuilder.name(paymentRequiredTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic paymentCompletedTopic() {
        return TopicBuilder.name(paymentCompletedTopic)
                .partitions(3)
                .replicas(1)
                .build();
    }
}
