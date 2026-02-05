package com.tapello.event.web;

import com.tapello.event.dto.Client;
import com.tapello.event.dto.CreateClientRequest;
import com.tapello.event.dto.UpdateClientRequest;
import com.tapello.event.service.ClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Client> createClient(@RequestBody CreateClientRequest request) {
        Client response = clientService.createClient(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<Client>> getAllClients(
            @PageableDefault(size = 20, sort = "name") Pageable pageable,
            @RequestParam(required = false) String search) {
        Page<Client> clients = clientService.getAllClients(pageable, search);
        return ResponseEntity.ok(clients);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Client> getClientById(@PathVariable UUID id) {
        Client response = clientService.getClientById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Client> updateClient(
            @PathVariable UUID id,
            @RequestBody UpdateClientRequest request) {
        Client response = clientService.updateClient(id, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Client> uploadLogo(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        try {
            Client response = clientService.uploadLogo(id, file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload logo: " + e.getMessage(), e);
        }
    }

    @DeleteMapping("/{id}/logo")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Client> deleteLogo(@PathVariable UUID id) {
        try {
            Client response = clientService.deleteLogo(id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete logo: " + e.getMessage(), e);
        }
    }
}