package com.servio.event.web;

import com.servio.event.dto.EventOrderPoint;
import com.servio.event.service.EventOrderPointService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events/{eventId}/order-points")
@RequiredArgsConstructor
public class EventOrderPointController {

    private final EventOrderPointService eventOrderPointService;

    @GetMapping
    public ResponseEntity<List<EventOrderPoint>> getEventOrderPoints(@PathVariable UUID eventId) {
        List<EventOrderPoint> orderPoints = eventOrderPointService.getEventOrderPoints(eventId);
        return ResponseEntity.ok(orderPoints);
    }

    @PutMapping("/{orderPointId}")
    public ResponseEntity<EventOrderPoint> saveEventOrderPoint(
            @PathVariable UUID eventId,
            @PathVariable UUID orderPointId,
            @RequestBody EventOrderPoint request) {
        EventOrderPoint saved = eventOrderPointService.saveEventOrderPoint(eventId, orderPointId, request);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEventOrderPoint(@PathVariable UUID eventId, @PathVariable UUID id) {
        eventOrderPointService.deleteEventOrderPoint(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Split a pay-later order point and seed the new sibling with the same
     * per-event configuration (users, client name/phone/email, credit,
     * protocol, prepaid). Mobile Tables view drives this with the per-tile
     * split button.
     */
    @PostMapping("/{orderPointId}/split")
    public ResponseEntity<EventOrderPoint> splitOrderPoint(
            @PathVariable UUID eventId,
            @PathVariable UUID orderPointId) {
        EventOrderPoint created = eventOrderPointService.splitForEvent(eventId, orderPointId);
        return ResponseEntity.ok(created);
    }
}
