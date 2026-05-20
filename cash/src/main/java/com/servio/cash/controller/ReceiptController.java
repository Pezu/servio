package com.servio.cash.controller;

import com.servio.cash.dto.ReceiptRequest;
import com.servio.cash.dto.ReceiptResponse;
import com.servio.cash.service.DatecsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/receipt")
@RequiredArgsConstructor
public class ReceiptController {

    private final DatecsService datecsService;

    @PostMapping
    public ResponseEntity<ReceiptResponse> printReceipt(@RequestBody ReceiptRequest request) {
        log.info("Received receipt request with {} items", request.getItems() != null ? request.getItems().size() : 0);

        ReceiptResponse response = datecsService.printFiscalReceipt(request);

        if (response.isSuccess()) {
            log.info("Receipt printed successfully. Fiscal number: {}", response.getFiscalNumber());
            return ResponseEntity.ok(response);
        } else {
            log.error("Failed to print receipt: {}", response.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
