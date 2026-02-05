package com.tapello.event.service;

import com.tapello.event.dto.CreateLocationRequest;
import com.tapello.event.dto.Location;
import com.tapello.event.dto.UpdateLocationRequest;
import com.tapello.event.entity.ClientEntity;
import com.tapello.event.entity.LocationEntity;
import com.tapello.event.mapper.LocationMapper;
import com.tapello.event.repository.ClientRepository;
import com.tapello.event.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;
    private final ClientRepository clientRepository;
    private final LocationMapper locationMapper;

    public Location createLocation(UUID clientId, CreateLocationRequest request) {
        ClientEntity client = clientRepository.findById(clientId)
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + clientId));

        LocationEntity locationEntity = new LocationEntity();
        locationEntity.setName(request.getName());
        locationEntity.setClient(client);

        if (request.getParentId() != null) {
            LocationEntity parent = locationRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent location not found with id: " + request.getParentId()));
            locationEntity.setParent(parent);
        }

        LocationEntity savedLocation = locationRepository.save(locationEntity);
        return locationMapper.toDto(savedLocation);
    }

    public Location getLocationById(UUID id) {
        LocationEntity locationEntity = locationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + id));

        return locationMapper.toDto(locationEntity);
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
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + id));

        ClientEntity client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + request.getClientId()));

        locationEntity.setName(request.getName());
        locationEntity.setClient(client);

        if (request.getParentId() != null) {
            LocationEntity parent = locationRepository.findById(request.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent location not found with id: " + request.getParentId()));
            locationEntity.setParent(parent);
        } else {
            locationEntity.setParent(null);
        }

        LocationEntity updatedLocation = locationRepository.save(locationEntity);
        return locationMapper.toDto(updatedLocation);
    }

    public Page<Location> getSubLocations(UUID parentId, Pageable pageable) {
        return locationRepository.findByParentId(parentId, pageable)
                .map(locationMapper::toDto);
    }

    public void deleteLocation(UUID id) {
        LocationEntity locationEntity = locationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + id));
        locationRepository.delete(locationEntity);
    }
}