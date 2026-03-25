package com.servio.event.web;

import com.servio.event.dto.ClientType;
import com.servio.event.dto.CreateClientTypeRequest;
import com.servio.event.dto.UpdateClientTypeRequest;
import com.servio.event.service.ClientTypeService;
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
@RequestMapping("/api/client-types")
@RequiredArgsConstructor
public class ClientTypeController {

    private final ClientTypeService clientTypeService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<ClientType> createClientType(@RequestBody CreateClientTypeRequest request) {
        ClientType clientType = clientTypeService.createClientType(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(clientType);
    }

    @GetMapping
    public ResponseEntity<Page<ClientType>> getAllClientTypes(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(clientTypeService.getAllClientTypes(pageable));
    }

    @GetMapping("/all")
    public ResponseEntity<List<ClientType>> getAllClientTypesList() {
        return ResponseEntity.ok(clientTypeService.getAllClientTypesList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClientType> getClientTypeById(@PathVariable UUID id) {
        return ResponseEntity.ok(clientTypeService.getClientTypeById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<ClientType> updateClientType(@PathVariable UUID id, @RequestBody UpdateClientTypeRequest request) {
        return ResponseEntity.ok(clientTypeService.updateClientType(id, request));
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<ClientType> toggleActive(@PathVariable UUID id) {
        return ResponseEntity.ok(clientTypeService.toggleActive(id));
    }
}