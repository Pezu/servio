package com.servio.event.service;

import com.servio.event.dto.ClientType;
import com.servio.event.dto.CreateClientTypeRequest;
import com.servio.event.dto.UpdateClientTypeRequest;
import com.servio.event.entity.ClientTypeEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.ValidationException;
import com.servio.event.mapper.ClientTypeMapper;
import com.servio.event.repository.ClientTypeRepository;
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
public class ClientTypeService {

    private final ClientTypeRepository clientTypeRepository;
    private final ClientTypeMapper clientTypeMapper;

    @Transactional
    @CacheEvict(value = "clientTypes", allEntries = true)
    public ClientType createClientType(CreateClientTypeRequest request) {
        if (clientTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Client type with name '" + request.getName() + "' already exists");
        }

        ClientTypeEntity entity = clientTypeMapper.toEntity(request);
        ClientTypeEntity savedEntity = clientTypeRepository.save(entity);
        return clientTypeMapper.toDto(savedEntity);
    }

    public ClientType getClientTypeById(UUID id) {
        ClientTypeEntity entity = clientTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClientType", id));
        return clientTypeMapper.toDto(entity);
    }

    public Page<ClientType> getAllClientTypes(Pageable pageable) {
        return clientTypeRepository.findAll(pageable).map(clientTypeMapper::toDto);
    }

    @Cacheable(value = "clientTypes")
    public List<ClientType> getAllClientTypesList() {
        return clientTypeRepository.findAll().stream()
                .map(clientTypeMapper::toDto)
                .toList();
    }

    @Transactional
    @CacheEvict(value = "clientTypes", allEntries = true)
    public ClientType updateClientType(UUID id, UpdateClientTypeRequest request) {
        ClientTypeEntity entity = clientTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClientType", id));

        if (!entity.getName().equals(request.getName()) && clientTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Client type with name '" + request.getName() + "' already exists");
        }

        clientTypeMapper.updateEntity(request, entity);
        ClientTypeEntity savedEntity = clientTypeRepository.save(entity);
        return clientTypeMapper.toDto(savedEntity);
    }

    @Transactional
    @CacheEvict(value = "clientTypes", allEntries = true)
    public ClientType toggleActive(UUID id) {
        ClientTypeEntity entity = clientTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ClientType", id));

        entity.setActive(!entity.isActive());
        ClientTypeEntity savedEntity = clientTypeRepository.save(entity);
        return clientTypeMapper.toDto(savedEntity);
    }
}