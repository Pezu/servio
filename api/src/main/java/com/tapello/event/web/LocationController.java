package com.tapello.event.web;

import com.tapello.event.dto.CreateLocationRequest;
import com.tapello.event.dto.Location;
import com.tapello.event.dto.UpdateLocationRequest;
import com.tapello.event.service.LocationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @PostMapping("/client/{clientId}")
    public ResponseEntity<Location> createLocation(
            @PathVariable UUID clientId,
            @RequestBody CreateLocationRequest request,
            HttpServletRequest httpRequest) {
        checkClientAccess(clientId, httpRequest);
        Location response = locationService.createLocation(clientId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<Page<Location>> getLocationsByClientId(
            @PathVariable UUID clientId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<Location> locations = locationService.getLocationsByClientId(clientId, pageable);
        return ResponseEntity.ok(locations);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Location> getLocationById(@PathVariable UUID id) {
        Location response = locationService.getLocationById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Location> updateLocation(
            @PathVariable UUID id,
            @RequestBody UpdateLocationRequest request,
            HttpServletRequest httpRequest) {
        // Get the location to find its client
        Location location = locationService.getLocationById(id);
        checkClientAccess(location.getClientId(), httpRequest);
        Location response = locationService.updateLocation(id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLocation(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        // Get the location to find its client
        Location location = locationService.getLocationById(id);
        checkClientAccess(location.getClientId(), httpRequest);
        locationService.deleteLocation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{parentId}/sublocations")
    public ResponseEntity<Page<Location>> getSubLocations(
            @PathVariable UUID parentId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<Location> locations = locationService.getSubLocations(parentId, pageable);
        return ResponseEntity.ok(locations);
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