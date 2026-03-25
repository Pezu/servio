package com.servio.event.service;

import com.servio.event.dto.CreateVatTypeRequest;
import com.servio.event.dto.UpdateVatTypeRequest;
import com.servio.event.dto.VatType;
import com.servio.event.entity.VatTypeEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.ValidationException;
import com.servio.event.mapper.VatTypeMapper;
import com.servio.event.repository.VatTypeRepository;
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
public class VatTypeService {

    private final VatTypeRepository vatTypeRepository;
    private final VatTypeMapper vatTypeMapper;

    @Transactional
    @CacheEvict(value = "vatTypes", allEntries = true)
    public VatType createVatType(CreateVatTypeRequest request) {
        if (vatTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "VAT type with name '" + request.getName() + "' already exists");
        }

        VatTypeEntity entity = vatTypeMapper.toEntity(request);
        VatTypeEntity savedEntity = vatTypeRepository.save(entity);
        return vatTypeMapper.toDto(savedEntity);
    }

    public VatType getVatTypeById(UUID id) {
        VatTypeEntity entity = vatTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VatType", id));
        return vatTypeMapper.toDto(entity);
    }

    public Page<VatType> getAllVatTypes(Pageable pageable) {
        return vatTypeRepository.findAll(pageable).map(vatTypeMapper::toDto);
    }

    @Cacheable(value = "vatTypes")
    public List<VatType> getAllVatTypesList() {
        return vatTypeRepository.findAll().stream()
                .map(vatTypeMapper::toDto)
                .toList();
    }

    public List<VatType> getActiveVatTypes() {
        return vatTypeRepository.findByActiveTrue().stream()
                .map(vatTypeMapper::toDto)
                .toList();
    }

    @Transactional
    @CacheEvict(value = "vatTypes", allEntries = true)
    public VatType updateVatType(UUID id, UpdateVatTypeRequest request) {
        VatTypeEntity entity = vatTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VatType", id));

        if (!entity.getName().equals(request.getName()) && vatTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "VAT type with name '" + request.getName() + "' already exists");
        }

        vatTypeMapper.updateEntity(request, entity);
        VatTypeEntity savedEntity = vatTypeRepository.save(entity);
        return vatTypeMapper.toDto(savedEntity);
    }

    @Transactional
    @CacheEvict(value = "vatTypes", allEntries = true)
    public VatType toggleActive(UUID id) {
        VatTypeEntity entity = vatTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VatType", id));

        entity.setActive(!entity.isActive());
        VatTypeEntity savedEntity = vatTypeRepository.save(entity);
        return vatTypeMapper.toDto(savedEntity);
    }
}