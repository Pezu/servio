package com.tapello.event.service;

import com.tapello.event.dto.MenuItem;
import com.tapello.event.entity.ClientEntity;
import com.tapello.event.entity.LocationEntity;
import com.tapello.event.entity.MenuItemEntity;
import com.tapello.event.mapper.MenuItemMapper;
import com.tapello.event.repository.ClientRepository;
import com.tapello.event.repository.LocationRepository;
import com.tapello.event.repository.MenuItemRepository;
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
    private final LocationRepository locationRepository;
    private final ClientRepository clientRepository;
    private final MenuItemMapper menuItemMapper;
    private final ImageService imageService;

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

        MenuItemEntity savedEntity = menuItemRepository.save(entity);

        List<MenuItem> children = Optional.ofNullable(item.getChildren()).orElse(Collections.emptyList());
        for (int i = 0; i < children.size(); i++) {
            saveMenuItemRecursively(children.get(i), savedEntity, location, existingMap, i);
        }
    }

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

    // Client-level menu methods

    public List<MenuItem> getClientMenuTree(UUID clientId) {
        List<MenuItemEntity> allItems = menuItemRepository.findByClientIdOrderBySortOrder(clientId);

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
    public List<MenuItem> saveClientMenuTree(UUID clientId, List<MenuItem> menuItems) {
        ClientEntity client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client not found: " + clientId));

        // Get all existing items for this client
        Map<UUID, MenuItemEntity> existingMap = menuItemRepository.findByClientIdOrderBySortOrder(clientId).stream()
                .collect(Collectors.toMap(MenuItemEntity::getId, item -> item));

        // Collect all incoming IDs and delete items no longer present
        Set<UUID> incomingIds = collectIds(menuItems);
        existingMap.values().stream()
                .filter(existing -> !incomingIds.contains(existing.getId()))
                .forEach(menuItemRepository::delete);

        // Save/update menu items recursively with sort order
        List<MenuItem> items = Optional.ofNullable(menuItems).orElse(Collections.emptyList());
        for (int i = 0; i < items.size(); i++) {
            saveClientMenuItemRecursively(items.get(i), null, client, existingMap, i);
        }

        return getClientMenuTree(clientId);
    }

    private void saveClientMenuItemRecursively(MenuItem item, MenuItemEntity parent, ClientEntity client, Map<UUID, MenuItemEntity> existingMap, int sortOrder) {
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
                    newEntity.setClient(client);
                    newEntity.setParent(parent);
                    newEntity.setSortOrder(sortOrder);
                    return newEntity;
                });

        MenuItemEntity savedEntity = menuItemRepository.save(entity);

        List<MenuItem> children = Optional.ofNullable(item.getChildren()).orElse(Collections.emptyList());
        for (int i = 0; i < children.size(); i++) {
            saveClientMenuItemRecursively(children.get(i), savedEntity, client, existingMap, i);
        }
    }
}