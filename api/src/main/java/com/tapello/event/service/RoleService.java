package com.tapello.event.service;

import com.tapello.event.dto.CreateRoleRequest;
import com.tapello.event.dto.Role;
import com.tapello.event.dto.UpdateRoleRequest;
import com.tapello.event.entity.RoleEntity;
import com.tapello.event.mapper.RoleMapper;
import com.tapello.event.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final RoleMapper roleMapper;

    @Transactional
    public Role createRole(CreateRoleRequest request) {
        if (roleRepository.existsByName(request.getName())) {
            throw new RuntimeException("Role with name '" + request.getName() + "' already exists");
        }

        RoleEntity roleEntity = new RoleEntity();
        roleEntity.setName(request.getName());
        roleEntity.setDescription(request.getDescription());

        RoleEntity savedEntity = roleRepository.save(roleEntity);
        return roleMapper.toDto(savedEntity);
    }

    public Role getRoleById(UUID id) {
        RoleEntity roleEntity = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + id));
        return roleMapper.toDto(roleEntity);
    }

    public Page<Role> getAllRoles(Pageable pageable) {
        return roleRepository.findAll(pageable).map(roleMapper::toDto);
    }

    @Transactional
    public Role updateRole(UUID id, UpdateRoleRequest request) {
        RoleEntity roleEntity = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id: " + id));

        // Check if name is being changed and if new name already exists
        if (!roleEntity.getName().equals(request.getName()) && roleRepository.existsByName(request.getName())) {
            throw new RuntimeException("Role with name '" + request.getName() + "' already exists");
        }

        roleEntity.setName(request.getName());
        roleEntity.setDescription(request.getDescription());

        RoleEntity savedEntity = roleRepository.save(roleEntity);
        return roleMapper.toDto(savedEntity);
    }

    @Transactional
    public void deleteRole(UUID id) {
        if (!roleRepository.existsById(id)) {
            throw new RuntimeException("Role not found with id: " + id);
        }
        roleRepository.deleteById(id);
    }
}