package com.servio.event.service;

import com.servio.event.dto.Allergen;
import com.servio.event.dto.CreateAllergenRequest;
import com.servio.event.dto.UpdateAllergenRequest;
import com.servio.event.entity.AllergenEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.AllergenMapper;
import com.servio.event.repository.AllergenRepository;
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
public class AllergenService {

    private final AllergenRepository allergenRepository;
    private final AllergenMapper allergenMapper;

    @Transactional
    @CacheEvict(value = "allergens", allEntries = true)
    public Allergen createAllergen(CreateAllergenRequest request) {
        Integer nextNumber = allergenRepository.findMaxNumber() + 1;

        AllergenEntity allergenEntity = allergenMapper.toEntity(request);
        allergenEntity.setNumber(nextNumber);

        AllergenEntity savedEntity = allergenRepository.save(allergenEntity);
        return allergenMapper.toDto(savedEntity);
    }

    public Allergen getAllergenById(UUID id) {
        AllergenEntity allergenEntity = allergenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Allergen", id));
        return allergenMapper.toDto(allergenEntity);
    }

    public Page<Allergen> getAllAllergens(Pageable pageable) {
        return allergenRepository.findAll(pageable).map(allergenMapper::toDto);
    }

    @Transactional
    @CacheEvict(value = "allergens", allEntries = true)
    public Allergen updateAllergen(UUID id, UpdateAllergenRequest request) {
        AllergenEntity allergenEntity = allergenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Allergen", id));

        allergenMapper.updateEntity(request, allergenEntity);
        AllergenEntity savedEntity = allergenRepository.save(allergenEntity);
        return allergenMapper.toDto(savedEntity);
    }

    @Transactional
    @CacheEvict(value = "allergens", allEntries = true)
    public Allergen toggleActive(UUID id) {
        AllergenEntity allergenEntity = allergenRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Allergen", id));

        allergenEntity.setActive(!allergenEntity.isActive());
        AllergenEntity savedEntity = allergenRepository.save(allergenEntity);
        return allergenMapper.toDto(savedEntity);
    }

    @Cacheable(value = "allergens")
    public List<Allergen> getActiveAllergens() {
        return allergenRepository.findByActiveTrueOrderByNumberAsc().stream()
                .map(allergenMapper::toDto)
                .toList();
    }
}
