package com.tapello.event.service;

import com.tapello.event.dto.CreatePaymentTypeRequest;
import com.tapello.event.dto.PaymentType;
import com.tapello.event.dto.UpdatePaymentTypeRequest;
import com.tapello.event.entity.PaymentTypeEntity;
import com.tapello.event.mapper.PaymentTypeMapper;
import com.tapello.event.repository.PaymentTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentTypeService {

    private final PaymentTypeRepository paymentTypeRepository;
    private final PaymentTypeMapper paymentTypeMapper;

    @Transactional
    public PaymentType createPaymentType(CreatePaymentTypeRequest request) {
        if (paymentTypeRepository.existsByName(request.getName())) {
            throw new RuntimeException("Payment type with name '" + request.getName() + "' already exists");
        }

        PaymentTypeEntity entity = new PaymentTypeEntity();
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());

        PaymentTypeEntity savedEntity = paymentTypeRepository.save(entity);
        return paymentTypeMapper.toDto(savedEntity);
    }

    public PaymentType getPaymentTypeById(UUID id) {
        PaymentTypeEntity entity = paymentTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment type not found with id: " + id));
        return paymentTypeMapper.toDto(entity);
    }

    public Page<PaymentType> getAllPaymentTypes(Pageable pageable) {
        return paymentTypeRepository.findAll(pageable).map(paymentTypeMapper::toDto);
    }

    @Transactional
    public PaymentType updatePaymentType(UUID id, UpdatePaymentTypeRequest request) {
        PaymentTypeEntity entity = paymentTypeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Payment type not found with id: " + id));

        if (!entity.getName().equals(request.getName()) && paymentTypeRepository.existsByName(request.getName())) {
            throw new RuntimeException("Payment type with name '" + request.getName() + "' already exists");
        }

        entity.setName(request.getName());
        entity.setDescription(request.getDescription());

        PaymentTypeEntity savedEntity = paymentTypeRepository.save(entity);
        return paymentTypeMapper.toDto(savedEntity);
    }

    @Transactional
    public void deletePaymentType(UUID id) {
        if (!paymentTypeRepository.existsById(id)) {
            throw new RuntimeException("Payment type not found with id: " + id);
        }
        paymentTypeRepository.deleteById(id);
    }
}