package com.servio.event.service;

import com.servio.event.dto.Menu;
import com.servio.event.dto.MenuItem;
import com.servio.event.entity.AllergenEntity;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.MenuEntity;
import com.servio.event.entity.MenuItemEntity;
import com.servio.event.entity.VatTypeEntity;
import com.servio.event.mapper.MenuItemMapper;
import com.servio.event.repository.AllergenRepository;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.MenuItemRepository;
import com.servio.event.repository.MenuRepository;
import com.servio.event.repository.VatTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final MenuRepository menuRepository;
    private final LocationRepository locationRepository;
    private final AllergenRepository allergenRepository;
    private final VatTypeRepository vatTypeRepository;
    private final MenuItemMapper menuItemMapper;
    private final ImageService imageService;

    // ==================== Menu CRUD Operations ====================

    public List<Menu> getMenusByLocationId(UUID locationId) {
        return menuRepository.findByLocationIdOrderByName(locationId).stream()
                .map(this::toMenuDto)
                .toList();
    }

    @Transactional
    public Menu createMenu(UUID locationId, String name) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationId));

        MenuEntity menu = new MenuEntity();
        menu.setLocation(location);
        menu.setName(name);

        MenuEntity savedMenu = menuRepository.save(menu);
        return toMenuDto(savedMenu);
    }

    @Transactional
    public void deleteMenu(UUID menuId) {
        menuRepository.deleteById(menuId);
    }

    public Menu getMenuById(UUID menuId) {
        return menuRepository.findById(menuId)
                .map(this::toMenuDto)
                .orElseThrow(() -> new RuntimeException("Menu not found: " + menuId));
    }

    private Menu toMenuDto(MenuEntity entity) {
        Menu dto = new Menu();
        dto.setId(entity.getId());
        dto.setLocationId(entity.getLocation().getId());
        dto.setName(entity.getName());
        return dto;
    }

    // ==================== Menu Tree Operations by Menu ID ====================

    public List<MenuItem> getMenuTreeByMenuId(UUID menuId) {
        List<MenuItemEntity> allItems = menuItemRepository.findByMenuIdOrderBySortOrder(menuId);

        Map<UUID, MenuItem> dtoMap = allItems.stream()
                .collect(Collectors.toMap(MenuItemEntity::getId, menuItemMapper::toDto));

        // Build the tree by adding children to their parents (maintaining sort order)
        allItems.stream()
                .filter(entity -> Objects.nonNull(entity.getParent()))
                .forEach(entity -> Optional.ofNullable(dtoMap.get(entity.getParent().getId()))
                        .ifPresent(parentDto -> parentDto.getChildren().add(dtoMap.get(entity.getId()))));

        // Return root items (those without parents)
        return allItems.stream()
                .filter(mi -> Objects.isNull(mi.getParent()))
                .map(mi -> dtoMap.get(mi.getId()))
                .toList();
    }

    @Transactional
    public List<MenuItem> saveMenuTreeByMenuId(UUID menuId, List<MenuItem> menuItems) {
        MenuEntity menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("Menu not found: " + menuId));

        // Get all existing items for this menu
        Map<UUID, MenuItemEntity> existingMap = menuItemRepository.findByMenuIdOrderBySortOrder(menuId).stream()
                .collect(Collectors.toMap(MenuItemEntity::getId, item -> item));

        // Collect all incoming IDs and delete items no longer present
        Set<UUID> incomingIds = collectIds(menuItems);
        existingMap.values().stream()
                .filter(existing -> !incomingIds.contains(existing.getId()))
                .forEach(menuItemRepository::delete);

        // Save/update menu items recursively with sort order
        List<MenuItem> items = Optional.ofNullable(menuItems).orElse(Collections.emptyList());
        for (int i = 0; i < items.size(); i++) {
            saveMenuItemRecursivelyByMenu(items.get(i), null, menu, existingMap, i);
        }

        return getMenuTreeByMenuId(menuId);
    }

    private void saveMenuItemRecursivelyByMenu(MenuItem item, MenuItemEntity parent, MenuEntity menu, Map<UUID, MenuItemEntity> existingMap, int sortOrder) {
        MenuItemEntity entity = Optional.ofNullable(item.getId())
                .map(existingMap::get)
                .map(existing -> {
                    existing.setName(item.getName());
                    existing.setOrderable(Optional.ofNullable(item.getOrderable()).orElse(true));
                    existing.setPrice(item.getPrice());
                    existing.setDescription(item.getDescription());
                    existing.setParent(parent);
                    existing.setSortOrder(sortOrder);
                    return existing;
                })
                .orElseGet(() -> {
                    MenuItemEntity newEntity = new MenuItemEntity();
                    newEntity.setName(item.getName());
                    newEntity.setOrderable(Optional.ofNullable(item.getOrderable()).orElse(true));
                    newEntity.setPrice(item.getPrice());
                    newEntity.setDescription(item.getDescription());
                    newEntity.setMenu(menu);
                    newEntity.setLocation(menu.getLocation());
                    newEntity.setParent(parent);
                    newEntity.setSortOrder(sortOrder);
                    return newEntity;
                });

        // Handle allergens for orderable items (products) - batch load to avoid N+1
        if (Boolean.TRUE.equals(item.getOrderable()) && item.getAllergenIds() != null && !item.getAllergenIds().isEmpty()) {
            List<AllergenEntity> allergenList = allergenRepository.findAllById(item.getAllergenIds());
            entity.setAllergens(new HashSet<>(allergenList));
        } else {
            entity.setAllergens(new HashSet<>());
        }

        // Handle VAT type for orderable items (products)
        if (item.getVatTypeId() != null) {
            VatTypeEntity vatType = vatTypeRepository.findById(item.getVatTypeId()).orElse(null);
            entity.setVatType(vatType);
        } else {
            entity.setVatType(null);
        }

        MenuItemEntity savedEntity = menuItemRepository.save(entity);

        List<MenuItem> children = item.getChildren() != null ? item.getChildren() : Collections.emptyList();
        for (int i = 0; i < children.size(); i++) {
            saveMenuItemRecursivelyByMenu(children.get(i), savedEntity, menu, existingMap, i);
        }
    }

    // ==================== Legacy Location-based Operations ====================

    public List<MenuItem> getMenuTree(UUID locationId) {
        // Check if location has a parent - if so, use parent's menu
        UUID effectiveLocationId = locationRepository.findById(locationId)
                .map(location -> location.getParent() != null ? location.getParent().getId() : locationId)
                .orElse(locationId);

        List<MenuItemEntity> allItems = menuItemRepository.findByLocationIdOrderBySortOrder(effectiveLocationId);

        Map<UUID, MenuItem> dtoMap = allItems.stream()
                .collect(Collectors.toMap(MenuItemEntity::getId, menuItemMapper::toDto));

        // Build the tree by adding children to their parents (maintaining sort order)
        allItems.stream()
                .filter(entity -> Objects.nonNull(entity.getParent()))
                .forEach(entity -> Optional.ofNullable(dtoMap.get(entity.getParent().getId()))
                        .ifPresent(parentDto -> parentDto.getChildren().add(dtoMap.get(entity.getId()))));

        // Return root items (those without parents)
        return allItems.stream()
                .filter(mi -> Objects.isNull(mi.getParent()))
                .map(mi -> dtoMap.get(mi.getId()))
                .toList();
    }

    @Transactional
    public List<MenuItem> saveMenuTree(UUID locationId, List<MenuItem> menuItems) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new RuntimeException("Location not found: " + locationId));

        // If location has a parent, save to the parent location instead
        LocationEntity effectiveLocation = location.getParent() != null ? location.getParent() : location;
        UUID effectiveLocationId = effectiveLocation.getId();

        // Get all existing items for this location
        Map<UUID, MenuItemEntity> existingMap = menuItemRepository.findByLocationIdOrderBySortOrder(effectiveLocationId).stream()
                .collect(Collectors.toMap(MenuItemEntity::getId, item -> item));

        // Collect all incoming IDs and delete items no longer present
        Set<UUID> incomingIds = collectIds(menuItems);
        existingMap.values().stream()
                .filter(existing -> !incomingIds.contains(existing.getId()))
                .forEach(menuItemRepository::delete);

        // Save/update menu items recursively with sort order
        List<MenuItem> items = Optional.ofNullable(menuItems).orElse(Collections.emptyList());
        for (int i = 0; i < items.size(); i++) {
            saveMenuItemRecursively(items.get(i), null, effectiveLocation, existingMap, i);
        }

        return getMenuTree(locationId);
    }

    private Set<UUID> collectIds(List<MenuItem> items) {
        return Optional.ofNullable(items).orElse(Collections.emptyList()).stream()
                .flatMap(item -> Stream.concat(
                        Stream.ofNullable(item.getId()),
                        collectIds(item.getChildren()).stream()
                ))
                .collect(Collectors.toSet());
    }

    private void saveMenuItemRecursively(MenuItem item, MenuItemEntity parent, LocationEntity location, Map<UUID, MenuItemEntity> existingMap, int sortOrder) {
        MenuItemEntity entity = Optional.ofNullable(item.getId())
                .map(existingMap::get)
                .map(existing -> {
                    existing.setName(item.getName());
                    existing.setOrderable(Optional.ofNullable(item.getOrderable()).orElse(true));
                    existing.setPrice(item.getPrice());
                    existing.setDescription(item.getDescription());
                    existing.setParent(parent);
                    existing.setSortOrder(sortOrder);
                    return existing;
                })
                .orElseGet(() -> {
                    MenuItemEntity newEntity = new MenuItemEntity();
                    newEntity.setName(item.getName());
                    newEntity.setOrderable(Optional.ofNullable(item.getOrderable()).orElse(true));
                    newEntity.setPrice(item.getPrice());
                    newEntity.setDescription(item.getDescription());
                    newEntity.setLocation(location);
                    newEntity.setParent(parent);
                    newEntity.setSortOrder(sortOrder);
                    return newEntity;
                });

        // Handle allergens for orderable items (products) - batch load to avoid N+1
        if (Boolean.TRUE.equals(item.getOrderable()) && item.getAllergenIds() != null && !item.getAllergenIds().isEmpty()) {
            List<AllergenEntity> allergenList = allergenRepository.findAllById(item.getAllergenIds());
            entity.setAllergens(new HashSet<>(allergenList));
        } else {
            entity.setAllergens(new HashSet<>());
        }

        // Handle VAT type for orderable items (products)
        if (item.getVatTypeId() != null) {
            VatTypeEntity vatType = vatTypeRepository.findById(item.getVatTypeId()).orElse(null);
            entity.setVatType(vatType);
        } else {
            entity.setVatType(null);
        }

        MenuItemEntity savedEntity = menuItemRepository.save(entity);

        List<MenuItem> children = item.getChildren() != null ? item.getChildren() : Collections.emptyList();
        for (int i = 0; i < children.size(); i++) {
            saveMenuItemRecursively(children.get(i), savedEntity, location, existingMap, i);
        }
    }

    // ==================== Image Operations ====================

    public MenuItem uploadImage(UUID menuItemId, MultipartFile file) throws Exception {
        MenuItemEntity menuItemEntity = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found with id: " + menuItemId));

        // Delete existing image if present
        if (menuItemEntity.getImagePath() != null) {
            try {
                imageService.deleteImage(menuItemEntity.getImagePath());
            } catch (Exception e) {
                // Ignore deletion errors for old image
            }
        }

        String imagePath = imageService.uploadImage(file);
        menuItemEntity.setImagePath(imagePath);
        MenuItemEntity updatedMenuItem = menuItemRepository.save(menuItemEntity);
        return menuItemMapper.toDto(updatedMenuItem);
    }

    public MenuItem deleteImage(UUID menuItemId) throws Exception {
        MenuItemEntity menuItemEntity = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found with id: " + menuItemId));

        if (menuItemEntity.getImagePath() != null) {
            imageService.deleteImage(menuItemEntity.getImagePath());
            menuItemEntity.setImagePath(null);
            menuItemRepository.save(menuItemEntity);
        }

        return menuItemMapper.toDto(menuItemEntity);
    }

    public MenuItem getMenuItemById(UUID menuItemId) {
        MenuItemEntity menuItemEntity = menuItemRepository.findById(menuItemId)
                .orElseThrow(() -> new RuntimeException("Menu item not found with id: " + menuItemId));
        return menuItemMapper.toDto(menuItemEntity);
    }
}
