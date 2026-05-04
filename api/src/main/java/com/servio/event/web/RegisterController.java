package com.servio.event.web;

import com.servio.event.dto.RegisterRequest;
import com.servio.event.dto.Registration;
import com.servio.event.service.OrderPointService;
import com.servio.event.service.RegistrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/register")
@RequiredArgsConstructor
public class RegisterController {

    private final RegistrationService registrationService;
    private final OrderPointService orderPointService;

    @PostMapping("/events/{eventId}")
    public ResponseEntity<Registration> register(
            @PathVariable UUID eventId,
            @RequestParam(required = false) UUID orderPointId,
            @RequestParam(required = false) String nickname) {
        Registration response = registrationService.createRegistration(eventId, orderPointId, nickname);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/events/{eventId}/with-customer")
    public ResponseEntity<Registration> registerWithCustomer(
            @PathVariable UUID eventId,
            @RequestBody RegisterRequest request) {
        Registration response;
        if (request.hasCustomerId()) {
            // Use existing customer by ID
            response = registrationService.createRegistrationWithCustomerId(
                    eventId,
                    request.getOrderPointId(),
                    request.getNickname(),
                    request.getCustomerId()
            );
        } else {
            // Create or find customer from provided info
            response = registrationService.createRegistration(
                    eventId,
                    request.getOrderPointId(),
                    request.getNickname(),
                    request.toCustomer()
            );
        }
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

    @GetMapping("/order-points/{orderPointId}/pending")
    public ResponseEntity<List<Registration>> getPendingRegistrationsForOrderPoint(
            @PathVariable UUID orderPointId,
            @RequestParam UUID excludeRegistrationId) {
        List<Registration> pendingRegistrations = registrationService.getPendingRegistrationsForOrderPoint(orderPointId, excludeRegistrationId);
        return ResponseEntity.ok(pendingRegistrations);
    }

    @GetMapping("/order-points/{orderPointId}/approved")
    public ResponseEntity<List<Registration>> getApprovedRegistrationsForOrderPoint(
            @PathVariable UUID orderPointId,
            @RequestParam UUID excludeRegistrationId) {
        List<Registration> approvedRegistrations = registrationService.getApprovedRegistrationsForOrderPoint(orderPointId, excludeRegistrationId);
        return ResponseEntity.ok(approvedRegistrations);
    }

    @PostMapping("/{registrationId}/approve-by-client")
    public ResponseEntity<Registration> approveRegistrationByClient(
            @PathVariable UUID registrationId,
            @RequestParam UUID approverRegistrationId) {
        Registration response = registrationService.approveRegistrationByClient(registrationId, approverRegistrationId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{registrationId}/customer")
    public ResponseEntity<Registration> updateRegistrationCustomer(
            @PathVariable UUID registrationId,
            @RequestBody RegisterRequest request) {
        Registration response = registrationService.updateRegistrationCustomer(registrationId, request.toCustomer());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/order-points/{orderPointId}/info")
    public ResponseEntity<Map<String, Object>> getOrderPointInfo(@PathVariable UUID orderPointId) {
        var orderPoint = orderPointService.getOrderPointById(orderPointId);
        var result = new java.util.HashMap<String, Object>();
        result.put("id", orderPoint.getId().toString());
        result.put("name", orderPoint.getName());
        result.put("payLater", orderPoint.isPayLater());
        if (orderPoint.getMenuId() != null) {
            result.put("menuId", orderPoint.getMenuId().toString());
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/order-points/{orderPointId}/group")
    public ResponseEntity<List<Map<String, Object>>> getOrderPointGroup(@PathVariable UUID orderPointId) {
        var siblings = orderPointService.findGroupSiblings(orderPointId);
        var result = new java.util.ArrayList<Map<String, Object>>(siblings.size());
        for (var op : siblings) {
            var entry = new java.util.HashMap<String, Object>();
            entry.put("id", op.getId().toString());
            entry.put("name", op.getName());
            entry.put("payLater", op.isPayLater());
            if (op.getMenuId() != null) {
                entry.put("menuId", op.getMenuId().toString());
            }
            result.add(entry);
        }
        return ResponseEntity.ok(result);
    }
}