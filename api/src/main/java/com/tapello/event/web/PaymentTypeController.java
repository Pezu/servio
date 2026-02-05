package com.tapello.event.web;

import com.tapello.event.dto.CreatePaymentTypeRequest;
import com.tapello.event.dto.PaymentType;
import com.tapello.event.dto.UpdatePaymentTypeRequest;
import com.tapello.event.service.PaymentTypeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/payment-types")
@RequiredArgsConstructor
public class PaymentTypeController {

    private final PaymentTypeService paymentTypeService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<PaymentType> createPaymentType(@RequestBody CreatePaymentTypeRequest request) {
        PaymentType paymentType = paymentTypeService.createPaymentType(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentType);
    }

    @GetMapping
    public ResponseEntity<Page<PaymentType>> getAllPaymentTypes(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(paymentTypeService.getAllPaymentTypes(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaymentType> getPaymentTypeById(@PathVariable UUID id) {
        return ResponseEntity.ok(paymentTypeService.getPaymentTypeById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<PaymentType> updatePaymentType(@PathVariable UUID id, @RequestBody UpdatePaymentTypeRequest request) {
        return ResponseEntity.ok(paymentTypeService.updatePaymentType(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Void> deletePaymentType(@PathVariable UUID id) {
        paymentTypeService.deletePaymentType(id);
        return ResponseEntity.noContent().build();
    }
}