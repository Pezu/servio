package com.datecs.printerfpgate.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO primit de la cloud server prin WebSocket STOMP.
 * Oglindeste com.servio.cash.dto.ReceiptPayload de pe server.
 *
 * Server trimite pe /user/bridge/queue/ecr/print.
 */
@Data
@NoArgsConstructor
public class ServerReceiptPayload {

    private String requestId;
    private String eventId;
    private String paymentMethod;

    /** Adresa IP a casei de marcat tinta. */
    private String cashRegister;

    private List<Line> lines;

    @Data
    @NoArgsConstructor
    public static class Line {
        private String     name;
        private Integer    quantity;   // Integer, nu double — asa vine de pe server
        private BigDecimal unitPrice;  // pret cu TVA inclus
        private BigDecimal vat;        // cota TVA (%), ex: 9, 19, 21
    }
}
