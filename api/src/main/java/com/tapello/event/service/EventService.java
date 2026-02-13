package com.tapello.event.service;

import com.tapello.event.dto.CreateEventRequest;
import com.tapello.event.dto.Event;
import com.tapello.event.dto.UpdateEventRequest;
import com.tapello.event.entity.EventEntity;
import com.tapello.event.entity.LocationEntity;
import com.tapello.event.entity.MenuItemEntity;
import com.tapello.event.entity.PaymentTypeEntity;
import com.tapello.event.entity.UserEntity;
import com.tapello.event.mapper.EventMapper;
import com.tapello.event.repository.EventRepository;
import com.tapello.event.repository.LocationRepository;
import com.tapello.event.repository.MenuItemRepository;
import com.tapello.event.repository.PaymentTypeRepository;
import com.tapello.event.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final LocationRepository locationRepository;
    private final UserRepository userRepository;
    private final PaymentTypeRepository paymentTypeRepository;
    private final MenuItemRepository menuItemRepository;
    private final EventMapper eventMapper;
    private final ImageService imageService;

    public Event createEvent(UUID locationId, CreateEventRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + locationId));

        EventEntity eventEntity = new EventEntity();
        eventEntity.setName(request.getName());
        eventEntity.setStartDate(request.getStartDate());
        eventEntity.setEndDate(request.getEndDate());
        eventEntity.setLocation(location);

        if (request.getUserIds() != null && !request.getUserIds().isEmpty()) {
            List<UserEntity> users = userRepository.findAllById(request.getUserIds());
            eventEntity.setUsers(new HashSet<>(users));
        }

        if (request.getPaymentTypeIds() != null && !request.getPaymentTypeIds().isEmpty()) {
            List<PaymentTypeEntity> paymentTypes = paymentTypeRepository.findAllById(request.getPaymentTypeIds());
            eventEntity.setPaymentTypes(new HashSet<>(paymentTypes));
        }

        if (request.getMenuItemIds() != null && !request.getMenuItemIds().isEmpty()) {
            List<MenuItemEntity> menuItems = menuItemRepository.findAllById(request.getMenuItemIds());
            eventEntity.setMenuItems(new HashSet<>(menuItems));
        }

        EventEntity savedEvent = eventRepository.save(eventEntity);
        return eventMapper.toDto(savedEvent);
    }

    public Event getEventById(UUID id) {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + id));
        return eventMapper.toDto(eventEntity);
    }

    public Page<Event> getAllEvents(Pageable pageable) {
        return eventRepository.findAll(pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getEventsByLocationId(UUID locationId, Pageable pageable) {
        return eventRepository.findByLocationId(locationId, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getEventsByClientId(UUID clientId, Pageable pageable) {
        return eventRepository.findByClientId(clientId, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getEventsByUsername(String username, Pageable pageable) {
        return eventRepository.findByUsersUsername(username, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getActiveEventsByUsername(String username, Pageable pageable) {
        LocalDate now = LocalDate.now();
        return eventRepository.findByUsersUsernameAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
                username, now, now, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getAllActiveEvents(Pageable pageable) {
        LocalDate now = LocalDate.now();
        return eventRepository.findByStartDateLessThanEqualAndEndDateGreaterThanEqual(now, now, pageable)
                .map(eventMapper::toDto);
    }

    public Event updateEvent(UUID id, UpdateEventRequest request) {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new RuntimeException("Location not found with id: " + request.getLocationId()));

        eventEntity.setName(request.getName());
        eventEntity.setStartDate(request.getStartDate());
        eventEntity.setEndDate(request.getEndDate());
        eventEntity.setLocation(location);

        if (request.getUserIds() != null) {
            List<UserEntity> users = userRepository.findAllById(request.getUserIds());
            eventEntity.setUsers(new HashSet<>(users));
        } else {
            eventEntity.getUsers().clear();
        }

        if (request.getPaymentTypeIds() != null && !request.getPaymentTypeIds().isEmpty()) {
            List<PaymentTypeEntity> paymentTypes = paymentTypeRepository.findAllById(request.getPaymentTypeIds());
            eventEntity.setPaymentTypes(new HashSet<>(paymentTypes));
        } else {
            eventEntity.getPaymentTypes().clear();
        }

        if (request.getMenuItemIds() != null && !request.getMenuItemIds().isEmpty()) {
            List<MenuItemEntity> menuItems = menuItemRepository.findAllById(request.getMenuItemIds());
            eventEntity.setMenuItems(new HashSet<>(menuItems));
        } else {
            eventEntity.getMenuItems().clear();
        }

        EventEntity updatedEvent = eventRepository.save(eventEntity);
        return eventMapper.toDto(updatedEvent);
    }

    public Event uploadLogo(UUID id, MultipartFile file) throws Exception {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + id));

        // Delete old logo if exists
        if (eventEntity.getLogoPath() != null) {
            try {
                imageService.deleteImage(eventEntity.getLogoPath());
            } catch (Exception e) {
                // Ignore if old image doesn't exist
            }
        }

        String logoPath = imageService.uploadImage(file);
        eventEntity.setLogoPath(logoPath);

        EventEntity updatedEvent = eventRepository.save(eventEntity);
        return eventMapper.toDto(updatedEvent);
    }

    public Event deleteLogo(UUID id) throws Exception {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id: " + id));

        if (eventEntity.getLogoPath() != null) {
            imageService.deleteImage(eventEntity.getLogoPath());
            eventEntity.setLogoPath(null);
            eventRepository.save(eventEntity);
        }

        return eventMapper.toDto(eventEntity);
    }
}