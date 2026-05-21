package com.servio.event.web;

import com.servio.event.dto.CashRegisterReceiptResponse;
import com.servio.event.service.CashRegisterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Receives replies from connected ECR agents. The agent sends to /app/ecr/result
 * with a payload containing the original requestId plus the receipt data the
 * device produced. We resolve the matching CompletableFuture in the service.
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class EcrAgentController {

    private final CashRegisterService cashRegisterService;

    @MessageMapping("/ecr/result")
    public void handleAgentResult(@Payload AgentReplyPayload reply, Principal principal) {
        String deviceId = principal != null ? principal.getName() : "unknown";
        log.info("[ECR] Agent reply received from deviceId={} requestId={} eventId={} status={}",
                deviceId, reply.getRequestId(), reply.getEventId(),
                reply.getResponse() != null ? reply.getResponse().getStatus() : "null");
        if (reply.getRequestId() == null || reply.getEventId() == null || reply.getResponse() == null) {
            log.warn("[ECR] Malformed agent reply (missing requestId, eventId, or response): {}", reply);
            return;
        }
        cashRegisterService.handleAgentReply(reply.getRequestId(), reply.getEventId(), reply.getResponse());
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AgentReplyPayload {
        private String requestId;
        private String eventId;
        private CashRegisterReceiptResponse response;
    }
}
