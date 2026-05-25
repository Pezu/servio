package com.servio.event.web;

import com.servio.event.dto.CashRegisterOrderPointsResponse;
import com.servio.event.dto.UpdateCashRegisterOrderPointsRequest;
import com.servio.event.service.CashRegisterAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Cash-register-scoped endpoints. Cash registers themselves are created and
 * listed under {@code /api/events/{eventId}/cash-registers} (see
 * {@link EventController}); this controller hosts per-register actions that
 * don't need the event id in the URL.
 */
@RestController
@RequestMapping("/api/cash-registers")
@RequiredArgsConstructor
public class CashRegisterController {

    private final CashRegisterAssignmentService assignmentService;

    @GetMapping("/{cashRegisterId}/order-points")
    public ResponseEntity<CashRegisterOrderPointsResponse> getOrderPoints(@PathVariable UUID cashRegisterId) {
        return ResponseEntity.ok(assignmentService.getOrderPointsForCashRegister(cashRegisterId));
    }

    @PutMapping("/{cashRegisterId}/order-points")
    public ResponseEntity<CashRegisterOrderPointsResponse> setOrderPoints(
            @PathVariable UUID cashRegisterId,
            @RequestBody UpdateCashRegisterOrderPointsRequest request) {
        return ResponseEntity.ok(
                assignmentService.setOrderPointsForCashRegister(cashRegisterId, request.getOrderPointIds()));
    }
}
