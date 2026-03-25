package com.servio.event.web;

import com.servio.event.dto.CreateVatTypeRequest;
import com.servio.event.dto.UpdateVatTypeRequest;
import com.servio.event.dto.VatType;
import com.servio.event.service.VatTypeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/vat-types")
@RequiredArgsConstructor
public class VatTypeController {

    private final VatTypeService vatTypeService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<VatType> createVatType(@RequestBody CreateVatTypeRequest request) {
        VatType vatType = vatTypeService.createVatType(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(vatType);
    }

    @GetMapping
    public ResponseEntity<Page<VatType>> getAllVatTypes(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(vatTypeService.getAllVatTypes(pageable));
    }

    @GetMapping("/active")
    public ResponseEntity<List<VatType>> getActiveVatTypes() {
        return ResponseEntity.ok(vatTypeService.getActiveVatTypes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<VatType> getVatTypeById(@PathVariable UUID id) {
        return ResponseEntity.ok(vatTypeService.getVatTypeById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<VatType> updateVatType(@PathVariable UUID id, @RequestBody UpdateVatTypeRequest request) {
        return ResponseEntity.ok(vatTypeService.updateVatType(id, request));
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<VatType> toggleActive(@PathVariable UUID id) {
        return ResponseEntity.ok(vatTypeService.toggleActive(id));
    }
}