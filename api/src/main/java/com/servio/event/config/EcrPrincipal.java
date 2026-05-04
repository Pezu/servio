package com.servio.event.config;

import java.security.Principal;

/**
 * Principal attached to a WebSocket session belonging to an ECR agent. The
 * `deviceId` is used for routing per-user destinations via convertAndSendToUser.
 */
public class EcrPrincipal implements Principal {
    private final String deviceId;

    public EcrPrincipal(String deviceId) {
        this.deviceId = deviceId;
    }

    @Override
    public String getName() {
        return deviceId;
    }
}
