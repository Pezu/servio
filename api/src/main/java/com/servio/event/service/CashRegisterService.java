package com.servio.event.service;

import com.servio.event.dto.CashRegister;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CashRegisterService {

    private final CashRegisterRepository cashRegisterRepository;
    private final EventRepository eventRepository;

    public List<CashRegister> getByEventId(UUID eventId) {
        return cashRegisterRepository.findByEventIdOrderByName(eventId).stream()
                .map(this::toDto)
                .toList();
    }

    public CashRegister create(UUID eventId, CashRegister request) {
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));
        CashRegisterEntity entity = new CashRegisterEntity();
        entity.setName(request.getName());
        entity.setIpAddress(request.getIpAddress());
        entity.setEvent(event);
        return toDto(cashRegisterRepository.save(entity));
    }

    public CashRegister update(UUID id, CashRegister request) {
        CashRegisterEntity entity = cashRegisterRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CashRegister", id));
        entity.setName(request.getName());
        entity.setIpAddress(request.getIpAddress());
        return toDto(cashRegisterRepository.save(entity));
    }

    public void delete(UUID id) {
        cashRegisterRepository.deleteById(id);
    }

    private CashRegister toDto(CashRegisterEntity entity) {
        return new CashRegister(entity.getId(), entity.getName(), entity.getIpAddress(), entity.getEvent().getId());
    }
}
