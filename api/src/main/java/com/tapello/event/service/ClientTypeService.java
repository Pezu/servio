package com.tapello.event.service;

import com.tapello.event.dto.ClientType;
import com.tapello.event.dto.CreateClientTypeRequest;
import com.tapello.event.dto.UpdateClientTypeRequest;
import com.tapello.event.entity.ClientTypeEntity;
import com.tapello.event.mapper.ClientTypeMapper;
import com.tapello.event.repository.ClientTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClientTypeService {

    private final ClientTypeRepository clientTypeRepository;
    private final ClientTypeMapper clientTypeMapper;

    @Transactional
    public ClientType createClientType(CreateClientTypeRequest request) {
        if (clientTypeRepository.existsByName(request.getName())) {
            throw new RuntimeException("Client type with name '" + request.getName() + "' already exists");
        }

        ClientTypeEntity entity = new ClientTypeEntity();
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());

        ClientTypeEntity savedEntity = clientTypeRepository.save(entity);
        return clientTypeMapper.toDto(savedEntity);
    }

    public ClientType getClientTypeById(UUID id) {
        ClientTypeEntity entity = clientTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client type not found with id: " + id));
        return clientTypeMapper.toDto(entity);
    }

    public Page<ClientType> getAllClientTypes(Pageable pageable) {
        return clientTypeRepository.findAll(pageable).map(clientTypeMapper::toDto);
    }

    public List<ClientType> getAllClientTypesList() {
        return clientTypeRepository.findAll().stream()
                .map(clientTypeMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public ClientType updateClientType(UUID id, UpdateClientTypeRequest request) {
        ClientTypeEntity entity = clientTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client type not found with id: " + id));

        if (!entity.getName().equals(request.getName()) && clientTypeRepository.existsByName(request.getName())) {
            throw new RuntimeException("Client type with name '" + request.getName() + "' already exists");
        }

        entity.setName(request.getName());
        entity.setDescription(request.getDescription());

        ClientTypeEntity savedEntity = clientTypeRepository.save(entity);
        return clientTypeMapper.toDto(savedEntity);
    }

    @Transactional
    public void deleteClientType(UUID id) {
        if (!clientTypeRepository.existsById(id)) {
            throw new RuntimeException("Client type not found with id: " + id);
        }
        clientTypeRepository.deleteById(id);
    }
}