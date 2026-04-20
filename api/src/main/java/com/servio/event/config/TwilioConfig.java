package com.servio.event.config;

import com.twilio.Twilio;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@EnableConfigurationProperties(TwilioProperties.class)
@RequiredArgsConstructor
public class TwilioConfig {

    private final TwilioProperties twilioProperties;

    @PostConstruct
    public void init() {
        if (twilioProperties.enabled() && twilioProperties.accountSid() != null && twilioProperties.authToken() != null) {
            Twilio.init(twilioProperties.accountSid(), twilioProperties.authToken());
            log.info("Twilio initialized with account SID: {}", twilioProperties.accountSid());
        } else {
            log.info("Twilio is disabled or not configured");
        }
    }
}
