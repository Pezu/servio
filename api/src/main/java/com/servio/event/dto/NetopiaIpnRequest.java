package com.servio.event.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NetopiaIpnRequest {
    private Order order;
    private Payment payment;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Order {
        private String ntpID;
        private String orderID;
        private Double amount;
        private String currency;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Payment {
        private Integer status;
        private String message;
        private String maskedCardNumber;
        private String token;
    }
}
