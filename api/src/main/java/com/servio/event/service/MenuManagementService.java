package com.servio.event.service;

import com.servio.event.dto.CreateMenuRequest;
import com.servio.event.dto.Menu;
import com.servio.event.dto.UpdateMenuRequest;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.MenuEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.MenuMapper;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.MenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MenuManagementService {

    private final MenuRepository menuRepository;
    private final LocationRepository locationRepository;
    private final MenuMapper menuMapper;

    public Menu createMenu(UUID locationId, CreateMenuRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        MenuEntity menuEntity = new MenuEntity();
        menuEntity.setName(request.getName());
        menuEntity.setLocation(location);

        MenuEntity savedMenu = menuRepository.save(menuEntity);
        return menuMapper.toDto(savedMenu);
    }

    public Menu getMenuById(UUID id) {
        return menuRepository.findById(id)
                .map(menuMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Menu", id));
    }

    public Page<Menu> getMenusByLocationId(UUID locationId, Pageable pageable) {
        return menuRepository.findByLocationId(locationId, pageable)
                .map(menuMapper::toDto);
    }

    public Menu updateMenu(UUID id, UpdateMenuRequest request) {
        MenuEntity menuEntity = menuRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Menu", id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", request.getLocationId()));

        menuEntity.setName(request.getName());
        menuEntity.setLocation(location);

        MenuEntity updatedMenu = menuRepository.save(menuEntity);
        return menuMapper.toDto(updatedMenu);
    }

    public void deleteMenu(UUID id) {
        menuRepository.deleteById(id);
    }
}
