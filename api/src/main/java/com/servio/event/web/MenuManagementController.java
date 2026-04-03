package com.servio.event.web;

import com.servio.event.dto.CreateMenuRequest;
import com.servio.event.dto.Menu;
import com.servio.event.dto.MenuItem;
import com.servio.event.dto.UpdateMenuRequest;
import com.servio.event.service.MenuManagementService;
import com.servio.event.service.MenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
public class MenuManagementController {

    private final MenuManagementService menuManagementService;
    private final MenuService menuService;

    @PostMapping("/location/{locationId}")
    public ResponseEntity<Menu> createMenu(
            @PathVariable UUID locationId,
            @RequestBody CreateMenuRequest request) {
        Menu response = menuManagementService.createMenu(locationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/location/{locationId}")
    public ResponseEntity<Page<Menu>> getMenusByLocationId(
            @PathVariable UUID locationId,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        Page<Menu> menus = menuManagementService.getMenusByLocationId(locationId, pageable);
        return ResponseEntity.ok(menus);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Menu> getMenuById(@PathVariable UUID id) {
        Menu response = menuManagementService.getMenuById(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Menu> updateMenu(
            @PathVariable UUID id,
            @RequestBody UpdateMenuRequest request) {
        Menu response = menuManagementService.updateMenu(id, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMenu(@PathVariable UUID id) {
        menuManagementService.deleteMenu(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{menuId}/items")
    public ResponseEntity<List<MenuItem>> getMenuItems(@PathVariable UUID menuId) {
        return ResponseEntity.ok(menuService.getMenuItemTree(menuId));
    }

    @PutMapping("/{menuId}/items")
    public ResponseEntity<List<MenuItem>> saveMenuItems(
            @PathVariable UUID menuId,
            @RequestBody List<MenuItem> menuItems) {
        return ResponseEntity.ok(menuService.saveMenuItemTree(menuId, menuItems));
    }
}
