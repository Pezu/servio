package com.servio.event.web;

import com.servio.event.dto.CreateRoleRequest;
import com.servio.event.dto.Role;
import com.servio.event.dto.UpdateRoleRequest;
import com.servio.event.service.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleService roleService;

    @PostMapping
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Role> createRole(@RequestBody CreateRoleRequest request) {
        Role role = roleService.createRole(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(role);
    }

    @GetMapping
    public ResponseEntity<Page<Role>> getAllRoles(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ResponseEntity.ok(roleService.getAllRoles(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Role> getRoleById(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.getRoleById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Role> updateRole(@PathVariable UUID id, @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(roleService.updateRole(id, request));
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasRole('SUPER')")
    public ResponseEntity<Role> toggleActive(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.toggleActive(id));
    }
}