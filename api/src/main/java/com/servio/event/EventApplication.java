package com.servio.event;

import com.servio.event.config.NetopiaProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling
@EnableConfigurationProperties(NetopiaProperties.class)
public class EventApplication {

    public static void main(String[] args) {
        SpringApplication.run(EventApplication.class, args);
    }
}