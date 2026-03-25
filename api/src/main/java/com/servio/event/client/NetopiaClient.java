package com.servio.event.client;

import com.servio.event.dto.StartPaymentRequest;
import com.servio.event.dto.StartPaymentResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "netopiaClient", url = "${netopia.base-url}")
public interface NetopiaClient {

    @PostMapping("/payment/card/start")
    StartPaymentResponse startPayment(
            @RequestHeader("Authorization") String apiKey,
            @RequestBody StartPaymentRequest request
    );
}