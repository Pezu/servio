package com.tapello.event.web;

import com.tapello.event.dto.CreateUserRequest;
import com.tapello.event.dto.UpdateUserRequest;
import com.tapello.event.dto.User;
import com.tapello.event.service.UserService;
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
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping
    public ResponseEntity<User> createUser(
            @RequestBody CreateUserRequest request,
            HttpServletRequest httpRequest) {
        checkClientAccess(request.getClientId(), httpRequest);
        User user = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<Page<User>> getUsersByClientId(
            @PathVariable UUID clientId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(userService.getUsersByClientId(clientId, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(
            @PathVariable UUID id,
            @RequestBody UpdateUserRequest request,
            HttpServletRequest httpRequest) {
        // Get the user to find its client
        User user = userService.getUserById(id);
        checkClientAccess(user.getClientId(), httpRequest);
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        // Get the user to find its client
        User user = userService.getUserById(id);
        checkClientAccess(user.getClientId(), httpRequest);
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
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