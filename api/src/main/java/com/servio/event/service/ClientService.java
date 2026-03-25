package com.servio.event.service;

import com.servio.event.dto.Client;
import com.servio.event.dto.CreateClientRequest;
import com.servio.event.dto.UpdateClientRequest;
import com.servio.event.entity.ClientEntity;
import com.servio.event.entity.Status;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.ClientMapper;
import com.servio.event.repository.ClientRepository;
import com.servio.event.repository.ClientTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clientRepository;
    private final ClientTypeRepository clientTypeRepository;
    private final ClientMapper clientMapper;
    private final ImageService imageService;

    public Client createClient(CreateClientRequest request) {
        ClientEntity clientEntity = new ClientEntity();
        clientEntity.setName(request.getName());
        clientEntity.setPhone(request.getPhone());
        clientEntity.setEmail(request.getEmail());
        clientEntity.setStatus(Optional.ofNullable(request.getStatus()).orElse(Status.ACTIVE));

        // Functional approach: set client type if provided
        Optional.ofNullable(request.getClientTypeId())
                .flatMap(clientTypeRepository::findById)
                .ifPresent(clientEntity::setClientType);

        ClientEntity savedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(savedClient);
    }

    public Client getClientById(UUID id) {
        return clientRepository.findById(id)
                .map(clientMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Client", id));
    }

    public Page<Client> getAllClients(Pageable pageable, String search, String clientTypeName) {
        boolean hasSearch = search != null && !search.trim().isEmpty();
        boolean hasClientType = clientTypeName != null && !clientTypeName.trim().isEmpty();

        Page<ClientEntity> result;
        if (hasSearch && hasClientType) {
            result = clientRepository.searchByNameOrEmailOrPhoneAndClientTypeExcludingSystem(
                    search.trim(), clientTypeName.trim(), ClientRepository.SYSTEM_CLIENT_ID, pageable);
        } else if (hasSearch) {
            result = clientRepository.searchByNameOrEmailOrPhoneExcludingSystem(
                    search.trim(), ClientRepository.SYSTEM_CLIENT_ID, pageable);
        } else if (hasClientType) {
            result = clientRepository.findAllByClientTypeNameExcludingSystem(
                    clientTypeName.trim(), ClientRepository.SYSTEM_CLIENT_ID, pageable);
        } else {
            result = clientRepository.findAllExcludingSystem(ClientRepository.SYSTEM_CLIENT_ID, pageable);
        }
        return result.map(clientMapper::toDto);
    }

    public Client updateClient(UUID id, UpdateClientRequest request) {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client", id));

        clientEntity.setName(request.getName());
        clientEntity.setPhone(request.getPhone());
        clientEntity.setEmail(request.getEmail());
        clientEntity.setStatus(request.getStatus());

        // Functional approach: set or clear client type based on presence
        clientEntity.setClientType(
                Optional.ofNullable(request.getClientTypeId())
                        .flatMap(clientTypeRepository::findById)
                        .orElse(null)
        );

        ClientEntity updatedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(updatedClient);
    }

    public Client uploadLogo(UUID id, MultipartFile file) throws Exception {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client", id));

        // Delete old logo if exists (ignoring failures for non-existent images)
        Optional.ofNullable(clientEntity.getLogoPath())
                .ifPresent(path -> {
                    try { imageService.deleteImage(path); } catch (Exception ignored) {}
                });

        String logoPath = imageService.uploadImage(file);
        clientEntity.setLogoPath(logoPath);

        ClientEntity updatedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(updatedClient);
    }

    public Client deleteLogo(UUID id) throws Exception {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client", id));

        Optional.ofNullable(clientEntity.getLogoPath())
                .ifPresent(path -> {
                    try {
                        imageService.deleteImage(path);
                        clientEntity.setLogoPath(null);
                        clientRepository.save(clientEntity);
                    } catch (Exception ignored) {}
                });

        return clientMapper.toDto(clientEntity);
    }
}