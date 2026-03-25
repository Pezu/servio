package com.servio.event.service;

import com.servio.event.dto.CreateLocationRequest;
import com.servio.event.dto.Location;
import com.servio.event.dto.UpdateLocationRequest;
import com.servio.event.entity.ClientEntity;
import com.servio.event.entity.LocationEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.LocationMapper;
import com.servio.event.repository.ClientRepository;
import com.servio.event.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;
    private final ClientRepository clientRepository;
    private final LocationMapper locationMapper;

    public Location createLocation(UUID clientId, CreateLocationRequest request) {
        ClientEntity client = clientRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client", clientId));

        LocationEntity locationEntity = new LocationEntity();
        locationEntity.setName(request.getName());
        locationEntity.setClient(client);

        // Functional approach: set parent if provided
        Optional.ofNullable(request.getParentId())
                .flatMap(locationRepository::findById)
                .ifPresent(locationEntity::setParent);

        LocationEntity savedLocation = locationRepository.save(locationEntity);
        return locationMapper.toDto(savedLocation);
    }

    public Location getLocationById(UUID id) {
        return locationRepository.findById(id)
                .map(locationMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Location", id));
    }

    public Page<Location> getAllLocations(Pageable pageable) {
        return locationRepository.findAll(pageable)
                .map(locationMapper::toDto);
    }

    public Page<Location> getLocationsByClientId(UUID clientId, Pageable pageable) {
        return locationRepository.findByClientId(clientId, pageable)
                .map(locationMapper::toDto);
    }

    public Location updateLocation(UUID id, UpdateLocationRequest request) {
        LocationEntity locationEntity = locationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Location", id));

        ClientEntity client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client", request.getClientId()));

        locationEntity.setName(request.getName());
        locationEntity.setClient(client);

        // Functional approach: set or clear parent based on presence
        locationEntity.setParent(
                Optional.ofNullable(request.getParentId())
                        .flatMap(locationRepository::findById)
                        .orElse(null)
        );

        LocationEntity updatedLocation = locationRepository.save(locationEntity);
        return locationMapper.toDto(updatedLocation);
    }

    public Page<Location> getSubLocations(UUID parentId, Pageable pageable) {
        return locationRepository.findByParentId(parentId, pageable)
                .map(locationMapper::toDto);
    }

    public void deleteLocation(UUID id) {
        LocationEntity locationEntity = locationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Location", id));
        locationRepository.delete(locationEntity);
    }
}