package com.tapello.event.service;

import com.tapello.event.dto.Registration;
import com.tapello.event.entity.EventEntity;
import com.tapello.event.entity.RegistrationEntity;
import com.tapello.event.mapper.RegistrationMapper;
import com.tapello.event.repository.EventRepository;
import com.tapello.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final RegistrationMapper registrationMapper;

    public Registration createRegistration(UUID eventId) {
        // Validate that event exists
        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + eventId));

        RegistrationEntity registrationEntity = new RegistrationEntity();
        registrationEntity.setEvent(event);

        RegistrationEntity savedRegistration = registrationRepository.save(registrationEntity);
        return registrationMapper.toDto(savedRegistration);
    }
}