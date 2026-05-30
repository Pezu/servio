package com.datecs.printerfpgate.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Payload trimis catre server pe /app/ecr/result dupa tiparirea bonului.
 * Oglindeste com.servio.event.web.EcrAgentController.AgentReplyPayload.
 *
 * response.status trebuie sa fie "OK" sau "ERROR"  (nu "SUCCESS").
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentReplyPayload {

    private String   requestId;
    private String   eventId;
    private Response response;

    /**
     * Oglindeste com.servio.event.dto.CashRegisterReceiptResponse.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private String        status;              // "OK" | "ERROR"
        private String        receiptNumber;
        private String        fiscalReceiptId;
        private String        cashRegisterSerial;
        private LocalDateTime issuedAt;
        private BigDecimal    totalAmount;
        private String        paymentMethod;
        private String        errorCode;
        private String        errorMessage;
    }
}
