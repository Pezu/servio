package com.tapello.event.web;

import com.tapello.event.dto.Registration;
import com.tapello.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/register")
@RequiredArgsConstructor
public class RegisterController {

    private final RegistrationService registrationService;

    @PostMapping("/events/{eventId}")
    public ResponseEntity<Registration> register(
            @PathVariable UUID eventId,
            @RequestParam(required = false) UUID orderPointId) {
        Registration response = registrationService.createRegistration(eventId, orderPointId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{registrationId}")
    public ResponseEntity<Registration> getRegistration(@PathVariable UUID registrationId) {
        Registration response = registrationService.getRegistration(registrationId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/events/{eventId}/pending")
    public ResponseEntity<List<Registration>> getPendingRegistrations(@PathVariable UUID eventId) {
        List<Registration> pendingRegistrations = registrationService.getPendingRegistrations(eventId);
        return ResponseEntity.ok(pendingRegistrations);
    }

    @PostMapping("/{registrationId}/approve")
    public ResponseEntity<Registration> approveRegistration(
            @PathVariable UUID registrationId,
            Authentication authentication) {
        String approvedBy = authentication != null ? authentication.getName() : "unknown";
        Registration response = registrationService.approveRegistration(registrationId, approvedBy);
        return ResponseEntity.ok(response);
    }
}