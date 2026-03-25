package com.servio.event.service;

import com.servio.event.dto.CreateRoleRequest;
import com.servio.event.dto.Role;
import com.servio.event.dto.UpdateRoleRequest;
import com.servio.event.entity.RoleEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.ValidationException;
import com.servio.event.mapper.RoleMapper;
import com.servio.event.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final RoleMapper roleMapper;

    @Transactional
    @CacheEvict(value = "roles", allEntries = true)
    public Role createRole(CreateRoleRequest request) {
        if (roleRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Role with name '" + request.getName() + "' already exists");
        }

        RoleEntity roleEntity = roleMapper.toEntity(request);
        RoleEntity savedEntity = roleRepository.save(roleEntity);
        return roleMapper.toDto(savedEntity);
    }

    public Role getRoleById(UUID id) {
        RoleEntity roleEntity = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));
        return roleMapper.toDto(roleEntity);
    }

    public Page<Role> getAllRoles(Pageable pageable) {
        return roleRepository.findAll(pageable).map(roleMapper::toDto);
    }

    @Cacheable(value = "roles")
    public List<Role> getAllRolesList() {
        return roleRepository.findAll().stream()
                .map(roleMapper::toDto)
                .toList();
    }

    @Transactional
    @CacheEvict(value = "roles", allEntries = true)
    public Role updateRole(UUID id, UpdateRoleRequest request) {
        RoleEntity roleEntity = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));

        if (!roleEntity.getName().equals(request.getName()) && roleRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Role with name '" + request.getName() + "' already exists");
        }

        roleMapper.updateEntity(request, roleEntity);
        RoleEntity savedEntity = roleRepository.save(roleEntity);
        return roleMapper.toDto(savedEntity);
    }

    @Transactional
    @CacheEvict(value = "roles", allEntries = true)
    public Role toggleActive(UUID id) {
        RoleEntity roleEntity = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id));

        roleEntity.setActive(!roleEntity.isActive());
        RoleEntity savedEntity = roleRepository.save(roleEntity);
        return roleMapper.toDto(savedEntity);
    }
}