package com.servio.gateway.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RedisNotificationMessage implements Serializable {
    private String destination;
    private WebSocketNotification notification;
}
