package com.servio.event.service;

import com.servio.event.dto.CreatePaymentTypeRequest;
import com.servio.event.dto.PaymentType;
import com.servio.event.dto.UpdatePaymentTypeRequest;
import com.servio.event.entity.PaymentTypeEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.ValidationException;
import com.servio.event.mapper.PaymentTypeMapper;
import com.servio.event.repository.PaymentTypeRepository;
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
public class PaymentTypeService {

    private final PaymentTypeRepository paymentTypeRepository;
    private final PaymentTypeMapper paymentTypeMapper;

    @Transactional
    @CacheEvict(value = "paymentTypes", allEntries = true)
    public PaymentType createPaymentType(CreatePaymentTypeRequest request) {
        if (paymentTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Payment type with name '" + request.getName() + "' already exists");
        }

        PaymentTypeEntity entity = paymentTypeMapper.toEntity(request);
        PaymentTypeEntity savedEntity = paymentTypeRepository.save(entity);
        return paymentTypeMapper.toDto(savedEntity);
    }

    public PaymentType getPaymentTypeById(UUID id) {
        PaymentTypeEntity entity = paymentTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PaymentType", id));
        return paymentTypeMapper.toDto(entity);
    }

    public Page<PaymentType> getAllPaymentTypes(Pageable pageable) {
        return paymentTypeRepository.findAll(pageable).map(paymentTypeMapper::toDto);
    }

    @Cacheable(value = "paymentTypes")
    public List<PaymentType> getAllPaymentTypesList() {
        return paymentTypeRepository.findAll().stream()
                .map(paymentTypeMapper::toDto)
                .toList();
    }

    @Transactional
    @CacheEvict(value = "paymentTypes", allEntries = true)
    public PaymentType updatePaymentType(UUID id, UpdatePaymentTypeRequest request) {
        PaymentTypeEntity entity = paymentTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PaymentType", id));

        if (!entity.getName().equals(request.getName()) && paymentTypeRepository.existsByName(request.getName())) {
            throw new ValidationException("name", "Payment type with name '" + request.getName() + "' already exists");
        }

        paymentTypeMapper.updateEntity(request, entity);
        PaymentTypeEntity savedEntity = paymentTypeRepository.save(entity);
        return paymentTypeMapper.toDto(savedEntity);
    }

    @Transactional
    @CacheEvict(value = "paymentTypes", allEntries = true)
    public PaymentType toggleActive(UUID id) {
        PaymentTypeEntity entity = paymentTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PaymentType", id));

        entity.setActive(!entity.isActive());
        PaymentTypeEntity savedEntity = paymentTypeRepository.save(entity);
        return paymentTypeMapper.toDto(savedEntity);
    }
}