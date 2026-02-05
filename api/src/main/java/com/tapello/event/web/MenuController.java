package com.tapello.event.web;

import com.tapello.event.dto.Location;
import com.tapello.event.dto.MenuItem;
import com.tapello.event.service.LocationService;
import com.tapello.event.service.MenuService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/menu")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;
    private final LocationService locationService;

    @GetMapping("/location/{locationId}")
    public ResponseEntity<List<MenuItem>> getMenuTree(@PathVariable UUID locationId) {
        List<MenuItem> menuTree = menuService.getMenuTree(locationId);
        return ResponseEntity.ok(menuTree);
    }

    @PutMapping("/location/{locationId}")
    public ResponseEntity<List<MenuItem>> updateMenuTree(
            @PathVariable UUID locationId,
            @RequestBody List<MenuItem> menuItems,
            HttpServletRequest httpRequest) {
        // Get the location to find its client
        Location location = locationService.getLocationById(locationId);
        checkClientAccess(location.getClientId(), httpRequest);
        List<MenuItem> updatedTree = menuService.saveMenuTree(locationId, menuItems);
        return ResponseEntity.ok(updatedTree);
    }

    @PostMapping(value = "/item/{menuItemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MenuItem> uploadImage(
            @PathVariable UUID menuItemId,
            @RequestParam("file") MultipartFile file,
            HttpServletRequest httpRequest) {
        try {
            // Get the menu item to find its client
            MenuItem menuItem = menuService.getMenuItemById(menuItemId);
            checkClientAccess(menuItem.getClientId(), httpRequest);
            MenuItem response = menuService.uploadImage(menuItemId, file);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload image: " + e.getMessage(), e);
        }
    }

    @DeleteMapping("/item/{menuItemId}/image")
    public ResponseEntity<MenuItem> deleteImage(
            @PathVariable UUID menuItemId,
            HttpServletRequest httpRequest) {
        try {
            // Get the menu item to find its client
            MenuItem menuItem = menuService.getMenuItemById(menuItemId);
            checkClientAccess(menuItem.getClientId(), httpRequest);
            MenuItem response = menuService.deleteImage(menuItemId);
            return ResponseEntity.ok(response);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to delete image: " + e.getMessage(), e);
        }
    }

    // Client-level menu endpoints

    @GetMapping("/client/{clientId}")
    public ResponseEntity<List<MenuItem>> getClientMenuTree(@PathVariable UUID clientId) {
        List<MenuItem> menuTree = menuService.getClientMenuTree(clientId);
        return ResponseEntity.ok(menuTree);
    }

    @PutMapping("/client/{clientId}")
    public ResponseEntity<List<MenuItem>> updateClientMenuTree(
            @PathVariable UUID clientId,
            @RequestBody List<MenuItem> menuItems,
            HttpServletRequest httpRequest) {
        checkClientAccess(clientId, httpRequest);
        List<MenuItem> updatedTree = menuService.saveClientMenuTree(clientId, menuItems);
        return ResponseEntity.ok(updatedTree);
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