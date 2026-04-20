package com.servio.event.web;

import com.servio.event.dto.CashRegister;
import com.servio.event.service.CashRegisterService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events/{eventId}/cash-registers")
@RequiredArgsConstructor
public class CashRegisterController {

    private final CashRegisterService cashRegisterService;

    @GetMapping
    public ResponseEntity<List<CashRegister>> getByEventId(@PathVariable UUID eventId) {
        return ResponseEntity.ok(cashRegisterService.getByEventId(eventId));
    }

    @PostMapping
    public ResponseEntity<CashRegister> create(@PathVariable UUID eventId, @RequestBody CashRegister request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(cashRegisterService.create(eventId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CashRegister> update(@PathVariable UUID eventId, @PathVariable UUID id, @RequestBody CashRegister request) {
        return ResponseEntity.ok(cashRegisterService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID eventId, @PathVariable UUID id) {
        cashRegisterService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
