package com.servio.event.web;

import com.servio.event.dto.Allergen;
import com.servio.event.dto.CreateAllergenRequest;
import com.servio.event.dto.UpdateAllergenRequest;
import com.servio.event.service.AllergenService;
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
@RequestMapping("/api/allergens")
@RequiredArgsConstructor
public class AllergenController {

    private final AllergenService allergenService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Allergen> createAllergen(@RequestBody CreateAllergenRequest request) {
        Allergen allergen = allergenService.createAllergen(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(allergen);
    }

    @GetMapping
    public ResponseEntity<Page<Allergen>> getAllAllergens(
            @PageableDefault(size = 20, sort = "number") Pageable pageable) {
        return ResponseEntity.ok(allergenService.getAllAllergens(pageable));
    }

    @GetMapping("/active")
    public ResponseEntity<List<Allergen>> getActiveAllergens() {
        return ResponseEntity.ok(allergenService.getActiveAllergens());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Allergen> getAllergenById(@PathVariable UUID id) {
        return ResponseEntity.ok(allergenService.getAllergenById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Allergen> updateAllergen(@PathVariable UUID id, @RequestBody UpdateAllergenRequest request) {
        return ResponseEntity.ok(allergenService.updateAllergen(id, request));
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Allergen> toggleActive(@PathVariable UUID id) {
        return ResponseEntity.ok(allergenService.toggleActive(id));
    }
}
