package com.tapello.event.service;

import com.tapello.event.dto.Client;
import com.tapello.event.dto.CreateClientRequest;
import com.tapello.event.dto.UpdateClientRequest;
import com.tapello.event.entity.ClientEntity;
import com.tapello.event.entity.ClientTypeEntity;
import com.tapello.event.entity.Status;
import com.tapello.event.mapper.ClientMapper;
import com.tapello.event.repository.ClientRepository;
import com.tapello.event.repository.ClientTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
        clientEntity.setStatus(request.getStatus() != null ? request.getStatus() : Status.ACTIVE);

        // Handle client type
        if (request.getClientTypeId() != null) {
            ClientTypeEntity clientType = clientTypeRepository.findById(request.getClientTypeId())
                    .orElseThrow(() -> new RuntimeException("Client type not found with id: " + request.getClientTypeId()));
            clientEntity.setClientType(clientType);
        }

        ClientEntity savedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(savedClient);
    }

    public Client getClientById(UUID id) {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));
        return clientMapper.toDto(clientEntity);
    }

    public Page<Client> getAllClients(Pageable pageable, String search) {
        if (search != null && !search.trim().isEmpty()) {
            return clientRepository.searchByNameOrEmailOrPhone(search.trim(), pageable)
                    .map(clientMapper::toDto);
        }
        return clientRepository.findAll(pageable)
                .map(clientMapper::toDto);
    }

    public Client updateClient(UUID id, UpdateClientRequest request) {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));

        clientEntity.setName(request.getName());
        clientEntity.setPhone(request.getPhone());
        clientEntity.setEmail(request.getEmail());
        clientEntity.setStatus(request.getStatus());

        // Handle client type
        if (request.getClientTypeId() != null) {
            ClientTypeEntity clientType = clientTypeRepository.findById(request.getClientTypeId())
                    .orElseThrow(() -> new RuntimeException("Client type not found with id: " + request.getClientTypeId()));
            clientEntity.setClientType(clientType);
        } else {
            clientEntity.setClientType(null);
        }

        ClientEntity updatedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(updatedClient);
    }

    public Client uploadLogo(UUID id, MultipartFile file) throws Exception {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));

        // Delete old logo if exists
        if (clientEntity.getLogoPath() != null) {
            try {
                imageService.deleteImage(clientEntity.getLogoPath());
            } catch (Exception e) {
                // Ignore if old image doesn't exist
            }
        }

        String logoPath = imageService.uploadImage(file);
        clientEntity.setLogoPath(logoPath);

        ClientEntity updatedClient = clientRepository.save(clientEntity);
        return clientMapper.toDto(updatedClient);
    }

    public Client deleteLogo(UUID id) throws Exception {
        ClientEntity clientEntity = clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + id));

        if (clientEntity.getLogoPath() != null) {
            imageService.deleteImage(clientEntity.getLogoPath());
            clientEntity.setLogoPath(null);
            clientRepository.save(clientEntity);
        }

        return clientMapper.toDto(clientEntity);
    }
}