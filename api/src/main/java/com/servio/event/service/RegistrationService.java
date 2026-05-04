package com.servio.event.service;

import com.servio.event.dto.Customer;
import com.servio.event.dto.Registration;
import com.servio.event.entity.CustomerEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.UnauthorizedAccessException;
import com.servio.event.mapper.RegistrationMapper;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.OrderRepository;
import com.servio.event.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final RegistrationRepository registrationRepository;
    private final EventRepository eventRepository;
    private final OrderPointRepository orderPointRepository;
    private final OrderRepository orderRepository;
    private final CustomerService customerService;
    private final RegistrationMapper registrationMapper;
    private final RegistrationNotificationService registrationNotificationService;

    public Registration createRegistration(UUID eventId, UUID orderPointId, String nickname) {
        return createRegistrationInternal(eventId, orderPointId, nickname, null, null);
    }

    @Transactional
    public Registration createRegistration(UUID eventId, UUID orderPointId, String nickname, Customer customerInfo) {
        return createRegistrationInternal(eventId, orderPointId, nickname, null, customerInfo);
    }

    @Transactional
    public Registration createRegistrationWithCustomerId(UUID eventId, UUID orderPointId, String nickname, UUID customerId) {
        return createRegistrationInternal(eventId, orderPointId, nickname, customerId, null);
    }

    private Registration createRegistrationInternal(UUID eventId, UUID orderPointId, String nickname, UUID customerId, Customer customerInfo) {
        log.info("Creating registration with nickname: {}, customerId: {}, customerInfo: {}", nickname, customerId, customerInfo != null);

        // Get customer entity - either by ID or by creating/finding from info
        CustomerEntity customer = null;
        if (customerId != null) {
            customer = customerService.getCustomerEntity(customerId);
            log.info("Using existing customer: {}", customer.getId());
        } else if (customerInfo != null && customerInfo.getPrefix() != null && customerInfo.getPhone() != null) {
            Customer createdCustomer = customerService.findOrCreateCustomer(customerInfo);
            customer = customerService.getCustomerEntity(createdCustomer.getId());
            log.info("Found/created customer: {}", customer.getId());
        }

        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        OrderPointEntity orderPoint = orderPointId == null
                ? null
                : orderPointRepository.findById(orderPointId).orElse(null);

        // Reuse an existing registration for the same event+orderPoint+customer
        // tuple, but re-evaluate the validation rule first: if the row is PENDING
        // because the event used to require validation but no longer does, upgrade
        // it to APPROVED so the customer doesn't get stuck on the waiting screen.
        if (customer != null && orderPointId != null) {
            Optional<RegistrationEntity> existing =
                    registrationRepository.findByEventIdAndOrderPointIdAndCustomerId(eventId, orderPointId, customer.getId());
            if (existing.isPresent()) {
                RegistrationEntity reg = existing.get();
                log.info("Found existing registration {} for event={}, orderPoint={}, customer={}",
                        reg.getId(), eventId, orderPointId, customer.getId());
                ValidationStatus required = computeRequiredValidationStatus(event, orderPoint);
                if (reg.getValidationStatus() == ValidationStatus.PENDING && required == ValidationStatus.APPROVED) {
                    log.info("Auto-approving stale PENDING registration {} (event no longer requires validation)", reg.getId());
                    reg = markApproved(reg, "system:auto-approved");
                }
                return registrationMapper.toDto(reg);
            }
        }

        RegistrationEntity registrationEntity = new RegistrationEntity();
        registrationEntity.setEvent(event);
        registrationEntity.setNickname(nickname);
        registrationEntity.setCustomer(customer);
        registrationEntity.setOrderPoint(orderPoint);
        log.info("Set nickname on entity: {}", registrationEntity.getNickname());

        ValidationStatus status = computeRequiredValidationStatus(event, orderPoint);
        log.debug("Setting registration status to {}", status);
        registrationEntity.setValidationStatus(status);

        RegistrationEntity savedRegistration = registrationRepository.save(registrationEntity);

        // Notify other clients at the same order point when a validation is requested
        if (status == ValidationStatus.PENDING) {
            registrationNotificationService.notifyValidationRequested(savedRegistration);
        }

        return registrationMapper.toDto(savedRegistration);
    }

    /**
     * Validation has been removed as a feature — every registration is auto-approved.
     */
    private ValidationStatus computeRequiredValidationStatus(EventEntity event, OrderPointEntity orderPoint) {
        return ValidationStatus.APPROVED;
    }

    /**
     * Marks a registration as APPROVED and notifies listeners. Single point of
     * mutation so the (status, approvedBy, approvedAt, save, notify) sequence
     * stays consistent across employee approval, peer approval, and the
     * auto-approval path used when an event's requireValidation flag is turned
     * off after a customer has already started waiting.
     */
    private RegistrationEntity markApproved(RegistrationEntity registration, String approvedBy) {
        registration.setValidationStatus(ValidationStatus.APPROVED);
        registration.setApprovedBy(approvedBy);
        registration.setApprovedAt(LocalDateTime.now());
        RegistrationEntity saved = registrationRepository.save(registration);
        registrationNotificationService.notifyRegistrationApproved(saved);
        return saved;
    }

    public Registration getRegistration(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(registrationMapper::toDto)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    public List<Registration> getPendingRegistrations(UUID eventId) {
        return registrationRepository.findByEventIdAndValidationStatus(eventId, ValidationStatus.PENDING)
                .stream()
                .map(registrationMapper::toDto)
                .toList();
    }

    public Registration approveRegistration(UUID registrationId, String approvedBy) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
        return registrationMapper.toDto(markApproved(registration, approvedBy));
    }

    public List<Registration> getPendingRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationRepository.findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.PENDING)
                .stream()
                .filter(r -> !r.getId().equals(excludeRegistrationId))
                .map(registrationMapper::toDto)
                .toList();
    }

    public List<Registration> getApprovedRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationRepository.findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED)
                .stream()
                .filter(r -> !r.getId().equals(excludeRegistrationId))
                .map(registrationMapper::toDto)
                .toList();
    }

    public Registration approveRegistrationByClient(UUID registrationId, UUID approverRegistrationId) {
        RegistrationEntity approverRegistration = registrationRepository.findById(approverRegistrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", approverRegistrationId));

        if (approverRegistration.getValidationStatus() != ValidationStatus.APPROVED) {
            throw new UnauthorizedAccessException("Only approved registrations can approve others");
        }

        RegistrationEntity targetRegistration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        // Validate order point requirements
        UUID approverOrderPointId = Optional.ofNullable(approverRegistration.getOrderPoint())
                .map(OrderPointEntity::getId)
                .orElseThrow(() -> new BusinessException("Both registrations must have an order point"));

        UUID targetOrderPointId = Optional.ofNullable(targetRegistration.getOrderPoint())
                .map(OrderPointEntity::getId)
                .orElseThrow(() -> new BusinessException("Both registrations must have an order point"));

        if (!approverOrderPointId.equals(targetOrderPointId)) {
            throw new BusinessException("Can only approve registrations for the same order point");
        }

        return registrationMapper.toDto(markApproved(targetRegistration, "client:" + approverRegistrationId));
    }

    /**
     * Gets the event ID for a registration.
     * Used by the Order microservice.
     */
    public UUID getEventIdByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(r -> r.getEvent().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    /**
     * Gets the nickname for a registration.
     * Used by the Order microservice.
     */
    public String getNicknameByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(RegistrationEntity::getNickname)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    /**
     * Gets the customer name (firstName lastName) for a registration.
     * Returns "Guest" if no customer is associated.
     * Used by the Order microservice for Netopia payments.
     */
    public String[] getCustomerNameByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(r -> {
                    if (r.getCustomer() != null) {
                        return new String[]{r.getCustomer().getFirstName(), r.getCustomer().getLastName()};
                    }
                    return new String[]{"Guest", "Customer"};
                })
                .orElse(new String[]{"Guest", "Customer"});
    }

    public String[] getCustomerNameByOrderId(UUID orderId) {
        return orderRepository.findById(orderId)
                .filter(o -> o.getRegistrationId() != null)
                .map(o -> getCustomerNameByRegistrationId(o.getRegistrationId()))
                .orElse(new String[]{"Guest", "Customer"});
    }

    public String[] getCustomerNameByOrderPointId(UUID orderPointId) {
        return registrationRepository.findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED).stream()
                .filter(r -> r.getCustomer() != null)
                .findFirst()
                .map(r -> new String[]{r.getCustomer().getFirstName(), r.getCustomer().getLastName()})
                .orElse(new String[]{"Guest", "Customer"});
    }

    /**
     * Updates a registration with customer info.
     * Used when customer info is provided after the registration was already created.
     */
    @Transactional
    public Registration updateRegistrationCustomer(UUID registrationId, Customer customerInfo) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        if (customerInfo != null && customerInfo.getPrefix() != null && customerInfo.getPhone() != null) {
            Customer createdCustomer = customerService.findOrCreateCustomer(customerInfo);
            CustomerEntity customer = customerService.getCustomerEntity(createdCustomer.getId());
            registration.setCustomer(customer);
            log.info("Linked customer {} to registration {}", customer.getId(), registrationId);
            registration = registrationRepository.save(registration);
        }

        return registrationMapper.toDto(registration);
    }
}