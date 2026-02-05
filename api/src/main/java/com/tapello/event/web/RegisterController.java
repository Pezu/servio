package com.tapello.event.web;

import com.tapello.event.dto.Registration;
import com.tapello.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/register")
@RequiredArgsConstructor
public class RegisterController {

    private final RegistrationService registrationService;

    @PostMapping("/events/{eventId}")
    public ResponseEntity<Registration> register(@PathVariable UUID eventId) {
        Registration response = registrationService.createRegistration(eventId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}