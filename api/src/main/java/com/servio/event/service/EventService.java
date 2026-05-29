package com.servio.event.service;

import com.servio.event.dto.CashRegister;
import com.servio.event.dto.CreateEventRequest;
import com.servio.event.dto.Event;
import com.servio.event.dto.UpdateEventRequest;
import com.servio.event.entity.CashRegisterEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.LocationEntity;
import com.servio.event.entity.MenuItemEntity;
import com.servio.event.entity.PaymentTypeEntity;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.UserEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.mapper.EventMapper;
import com.servio.event.repository.CashRegisterRepository;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.LocationRepository;
import com.servio.event.repository.MenuItemRepository;
import com.servio.event.repository.PaymentTypeRepository;
import com.servio.event.repository.RegistrationRepository;
import com.servio.event.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final LocationRepository locationRepository;
    private final UserRepository userRepository;
    private final PaymentTypeRepository paymentTypeRepository;
    private final MenuItemRepository menuItemRepository;
    private final CashRegisterRepository cashRegisterRepository;
    private final RegistrationRepository registrationRepository;
    private final EventMapper eventMapper;
    private final ImageService imageService;

    public Event createEvent(UUID locationId, CreateEventRequest request) {
        LocationEntity location = locationRepository.findById(locationId)
                .orElseThrow(() -> new ResourceNotFoundException("Location", locationId));

        EventEntity eventEntity = new EventEntity();
        eventEntity.setName(request.getName());
        eventEntity.setStartDate(request.getStartDate());
        eventEntity.setEndDate(request.getEndDate());
        eventEntity.setLocation(location);
        eventEntity.setRequireValidation(request.isRequireValidation());
        eventEntity.setPaused(request.isPaused());

        // Functional approach: batch load related entities
        Optional.ofNullable(request.getUserIds())
                .filter(ids -> !ids.isEmpty())
                .map(userRepository::findAllById)
                .map(HashSet::new)
                .ifPresent(eventEntity::setUsers);

        Optional.ofNullable(request.getWaiterUserIds())
                .filter(ids -> !ids.isEmpty())
                .map(userRepository::findAllById)
                .map(HashSet::new)
                .ifPresent(eventEntity::setWaiters);

        Optional.ofNullable(request.getPaymentTypeIds())
                .filter(ids -> !ids.isEmpty())
                .map(paymentTypeRepository::findAllById)
                .map(HashSet::new)
                .ifPresent(eventEntity::setPaymentTypes);

        Optional.ofNullable(request.getMenuItemIds())
                .filter(ids -> !ids.isEmpty())
                .map(menuItemRepository::findAllById)
                .map(HashSet::new)
                .ifPresent(eventEntity::setMenuItems);

        EventEntity savedEvent = eventRepository.save(eventEntity);
        ensureWaiterRegistrations(savedEvent);
        return eventMapper.toDto(savedEvent);
    }

    public Event getEventById(UUID id) {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event", id));
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
        return eventRepository.findActiveByServiceUserUsername(username, now, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getActiveEventsAssignedToUsername(String username, Pageable pageable) {
        LocalDate now = LocalDate.now();
        return eventRepository.findActiveAssignedToUsername(username, now, pageable)
                .map(eventMapper::toDto);
    }

    public Page<Event> getAllActiveEvents(Pageable pageable) {
        LocalDate now = LocalDate.now();
        return eventRepository.findByStartDateLessThanEqualAndEndDateGreaterThanEqual(now, now, pageable)
                .map(eventMapper::toDto);
    }

    public Event updateEvent(UUID id, UpdateEventRequest request) {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event", id));

        LocationEntity location = locationRepository.findById(request.getLocationId())
                .orElseThrow(() -> new ResourceNotFoundException("Location", request.getLocationId()));

        eventEntity.setName(request.getName());
        eventEntity.setStartDate(request.getStartDate());
        eventEntity.setEndDate(request.getEndDate());
        eventEntity.setLocation(location);
        eventEntity.setRequireValidation(request.isRequireValidation());
        eventEntity.setPaused(request.isPaused());

        // Functional approach: update or clear collections
        updateCollection(request.getUserIds(), userRepository::findAllById, eventEntity::setUsers, eventEntity.getUsers());
        updateCollection(request.getWaiterUserIds(), userRepository::findAllById, eventEntity::setWaiters, eventEntity.getWaiters());
        updateCollection(request.getPaymentTypeIds(), paymentTypeRepository::findAllById, eventEntity::setPaymentTypes, eventEntity.getPaymentTypes());
        updateCollection(request.getMenuItemIds(), menuItemRepository::findAllById, eventEntity::setMenuItems, eventEntity.getMenuItems());

        EventEntity updatedEvent = eventRepository.save(eventEntity);
        ensureWaiterRegistrations(updatedEvent);
        return eventMapper.toDto(updatedEvent);
    }

    /**
     * Provisions a registration for every waiter attached to the event so that
     * waiters can place orders against a stable registration id from the mobile
     * app. Existing registrations are reused; we never delete (orders reference
     * registration_id, so removing one would orphan history).
     */
    private void ensureWaiterRegistrations(EventEntity event) {
        Set<UserEntity> waiters = event.getWaiters();
        if (waiters == null || waiters.isEmpty()) return;
        for (UserEntity waiter : waiters) {
            if (registrationRepository.findByEventIdAndUserId(event.getId(), waiter.getId()).isPresent()) {
                continue;
            }
            RegistrationEntity registration = new RegistrationEntity();
            registration.setEvent(event);
            registration.setUser(waiter);
            registration.setNickname(waiter.getName());
            registrationRepository.save(registration);
        }
    }

    private <T, ID> void updateCollection(List<ID> ids,
                                          Function<List<ID>, List<T>> findAllById,
                                          java.util.function.Consumer<java.util.Set<T>> setter,
                                          Collection<T> currentCollection) {
        Optional.ofNullable(ids)
                .filter(list -> !list.isEmpty())
                .map(findAllById)
                .map(HashSet::new)
                .ifPresentOrElse(setter, currentCollection::clear);
    }

    public Event uploadLogo(UUID id, MultipartFile file) throws Exception {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event", id));

        // Delete old logo if exists (ignoring failures for non-existent images)
        Optional.ofNullable(eventEntity.getLogoPath())
                .ifPresent(path -> {
                    try { imageService.deleteImage(path); } catch (Exception ignored) {}
                });

        String logoPath = imageService.uploadImage(file);
        eventEntity.setLogoPath(logoPath);

        EventEntity updatedEvent = eventRepository.save(eventEntity);
        return eventMapper.toDto(updatedEvent);
    }

    public Event deleteLogo(UUID id) throws Exception {
        EventEntity eventEntity = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event", id));

        Optional.ofNullable(eventEntity.getLogoPath())
                .ifPresent(path -> {
                    try {
                        imageService.deleteImage(path);
                        eventEntity.setLogoPath(null);
                        eventRepository.save(eventEntity);
                    } catch (Exception ignored) {}
                });

        return eventMapper.toDto(eventEntity);
    }

    /**
     * Atomically increments and returns the next order number for an event.
     * Used by the Order microservice.
     */
    public Integer incrementAndGetLastOrderNo(UUID eventId) {
        return eventRepository.incrementAndGetLastOrderNo(eventId);
    }

    // Cash Register methods
    public List<CashRegister> getCashRegisters(UUID eventId) {
        return cashRegisterRepository.findByEventId(eventId).stream()
                .map(this::toCashRegisterDto)
                .collect(Collectors.toList());
    }

    /**
     * Upsert the cash registers for an event. Rows in the request that carry an
     * existing id are updated in place (so external references — the cash register
     * id is also the bridge agent's deviceId, and FK targets in
     * {@code cash_register_order_points} — stay stable). Rows without an id are
     * inserted, and rows present in the DB but absent from the request are deleted.
     */
    @Transactional
    public List<CashRegister> saveCashRegisters(UUID eventId, List<CashRegister> cashRegisters) {
        List<CashRegister> requested = cashRegisters == null ? List.of() : cashRegisters;
        List<CashRegisterEntity> existing = cashRegisterRepository.findByEventId(eventId);
        java.util.Map<UUID, CashRegisterEntity> existingById = existing.stream()
                .collect(Collectors.toMap(CashRegisterEntity::getId, e -> e));

        Set<UUID> requestedIds = requested.stream()
                .map(CashRegister::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        // Delete rows no longer present in the request. CASCADE drops any
        // cash_register_order_points rows for those cash registers.
        List<CashRegisterEntity> toDelete = existing.stream()
                .filter(e -> !requestedIds.contains(e.getId()))
                .collect(Collectors.toList());
        if (!toDelete.isEmpty()) {
            cashRegisterRepository.deleteAll(toDelete);
        }

        // Upsert each row in request order.
        List<CashRegisterEntity> saved = new java.util.ArrayList<>(requested.size());
        for (CashRegister cr : requested) {
            CashRegisterEntity entity;
            if (cr.getId() != null && existingById.containsKey(cr.getId())) {
                entity = existingById.get(cr.getId());
                entity.setName(cr.getName());
                entity.setIp(cr.getIp());
            } else {
                entity = CashRegisterEntity.builder()
                        .eventId(eventId)
                        .name(cr.getName())
                        .ip(cr.getIp())
                        .build();
            }
            saved.add(cashRegisterRepository.save(entity));
        }

        return saved.stream()
                .map(this::toCashRegisterDto)
                .collect(Collectors.toList());
    }

    private CashRegister toCashRegisterDto(CashRegisterEntity entity) {
        return CashRegister.builder()
                .id(entity.getId())
                .name(entity.getName())
                .ip(entity.getIp())
                .build();
    }
}