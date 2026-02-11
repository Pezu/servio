package com.tapello.event.web;

import com.google.zxing.WriterException;
import com.tapello.event.dto.CreateEventRequest;
import com.tapello.event.dto.Event;
import com.tapello.event.dto.Location;
import com.tapello.event.dto.MenuItem;
import com.tapello.event.dto.UpdateEventRequest;
import com.tapello.event.service.EventService;
import com.tapello.event.service.LocationService;
import com.tapello.event.service.MenuService;
import com.tapello.event.service.PdfGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final LocationService locationService;
    private final MenuService menuService;
    private final PdfGenerationService pdfGenerationService;

    @GetMapping("/my-events")
    public ResponseEntity<Page<Event>> getMyEvents(
            HttpServletRequest request,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        String username = (String) request.getAttribute("username");
        Page<Event> events = eventService.getEventsByUsername(username, pageable);
        return ResponseEntity.ok(events);
    }

    @GetMapping("/my-events/active")
    public ResponseEntity<Page<Event>> getMyActiveEvents(
            HttpServletRequest request,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        String username = (String) request.getAttribute("username");
        Page<Event> events = eventService.getActiveEventsByUsername(username, pageable);
        return ResponseEntity.ok(events);
    }

    @PostMapping("/location/{locationId}")
    public ResponseEntity<Event> createEvent(
            @PathVariable UUID locationId,
            @RequestBody CreateEventRequest request,
            HttpServletRequest httpRequest) {
        // Get the location to find its client
        Location location = locationService.getLocationById(locationId);
        checkClientAccess(location.getClientId(), httpRequest);
        Event response = eventService.createEvent(locationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/location/{locationId}")
    public ResponseEntity<Page<Event>> getEventsByLocationId(
            @PathVariable UUID locationId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<Event> events = eventService.getEventsByLocationId(locationId, pageable);
        return ResponseEntity.ok(events);
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<Page<Event>> getEventsByClientId(
            @PathVariable UUID clientId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<Event> events = eventService.getEventsByClientId(clientId, pageable);
        return ResponseEntity.ok(events);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Event> getEventById(@PathVariable UUID id) {
        Event response = eventService.getEventById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Event> updateEvent(
            @PathVariable UUID id,
            @RequestBody UpdateEventRequest request,
            HttpServletRequest httpRequest) {
        // Get the event to find its location's client
        Event event = eventService.getEventById(id);
        Location location = locationService.getLocationById(event.getLocationId());
        checkClientAccess(location.getClientId(), httpRequest);
        Event response = eventService.updateEvent(id, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{eventId}/qr")
    public ResponseEntity<byte[]> generateOrderPointsQrPdf(@PathVariable UUID eventId) {
        try {
            byte[] pdfBytes = pdfGenerationService.generateOrderPointsQrPdf(eventId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "qr-" + eventId + ".pdf");

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdfBytes);
        } catch (IOException | WriterException e) {
            throw new RuntimeException("Error generating PDF: " + e.getMessage(), e);
        }
    }

    @GetMapping("/{eventId}/menu")
    public ResponseEntity<List<MenuItem>> getEventMenu(@PathVariable UUID eventId) {
        Event event = eventService.getEventById(eventId);
        List<MenuItem> menuTree;

        // Check if event uses location menu (has menuItemIds) or client menu
        if (event.getMenuItemIds() != null && !event.getMenuItemIds().isEmpty()) {
            // Use location menu
            menuTree = menuService.getMenuTree(event.getLocationId());
        } else {
            // Use client menu - get client ID from location
            Location location = locationService.getLocationById(event.getLocationId());
            menuTree = menuService.getClientMenuTree(location.getClientId());
        }

        return ResponseEntity.ok(menuTree);
    }

    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Event> uploadLogo(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest httpRequest) {
        try {
            // Get the event to find its location's client
            Event event = eventService.getEventById(id);
            Location location = locationService.getLocationById(event.getLocationId());
            checkClientAccess(location.getClientId(), httpRequest);
            Event response = eventService.uploadLogo(id, file);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload logo: " + e.getMessage(), e);
        }
    }

    @DeleteMapping("/{id}/logo")
    public ResponseEntity<Event> deleteLogo(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        try {
            // Get the event to find its location's client
            Event event = eventService.getEventById(id);
            Location location = locationService.getLocationById(event.getLocationId());
            checkClientAccess(location.getClientId(), httpRequest);
            Event response = eventService.deleteLogo(id);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete logo: " + e.getMessage(), e);
        }
    }

    /**
     * Checks if the current user has access to modify resources for the given client.
     * SUPER users can access any client.
     * Other users can only access their own client.
     */
    private void checkClientAccess(UUID clientId, HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        // SUPER users can access any client
        if (auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER"))) {
            return;
        }

        // Get user's clientId from request attributes
        String userClientId = (String) request.getAttribute("clientId");

        // Check if user's client matches the requested client
        if (userClientId == null || !userClientId.equals(clientId.toString())) {
            throw new AccessDeniedException("Unauthorized");
        }
    }
}