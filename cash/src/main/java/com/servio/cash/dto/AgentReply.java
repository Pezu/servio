package com.servio.cash.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentReply {
    private String requestId;
    private String eventId;
    private ReceiptResponse response;
}