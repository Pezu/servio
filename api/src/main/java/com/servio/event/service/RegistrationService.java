package com.servio.event.service;

import com.servio.event.dto.Customer;
import com.servio.event.dto.Registration;
import com.servio.event.entity.CustomerEntity;
import com.servio.event.entity.EventEntity;
import com.servio.event.entity.OrderPointEntity;
import com.servio.event.entity.RegistrationEntity;
import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import com.servio.event.entity.RegistrationOrderPointEntity;
import com.servio.event.exception.BusinessException;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.UnauthorizedAccessException;
import com.servio.event.mapper.RegistrationMapper;
import com.servio.event.repository.EventRepository;
import com.servio.event.repository.OrderPointRepository;
import com.servio.event.repository.OrderRepository;
import com.servio.event.repository.RegistrationOrderPointRepository;
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
    private final RegistrationOrderPointRepository registrationOrderPointRepository;
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

    /**
     * Returns or creates a registration for (event, customer), then ensures a
     * junction row exists for (registration, orderPoint). Re-scans of any
     * order point are idempotent via the unique constraint on
     * registration_order_points(registration_id, order_point_id).
     */
    @Transactional
    private Registration createRegistrationInternal(UUID eventId, UUID orderPointId, String nickname, UUID customerId, Customer customerInfo) {
        log.info("Creating registration with nickname: {}, customerId: {}, customerInfo: {}", nickname, customerId, customerInfo != null);

        CustomerEntity customer = null;
        if (customerId != null) {
            customer = customerService.getCustomerEntity(customerId);
        } else if (customerInfo != null && customerInfo.getPrefix() != null && customerInfo.getPhone() != null) {
            Customer createdCustomer = customerService.findOrCreateCustomer(customerInfo);
            customer = customerService.getCustomerEntity(createdCustomer.getId());
        }

        EventEntity event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event", eventId));

        OrderPointEntity orderPoint = orderPointId == null
                ? null
                : orderPointRepository.findById(orderPointId).orElse(null);

        RegistrationEntity registration = null;
        if (customer != null) {
            registration = registrationRepository.findByEventIdAndCustomerId(eventId, customer.getId()).orElse(null);
        }
        if (registration == null) {
            registration = new RegistrationEntity();
            registration.setEvent(event);
            registration.setNickname(nickname);
            registration.setCustomer(customer);
            registration = registrationRepository.save(registration);
        } else if (nickname != null && !nickname.equals(registration.getNickname())) {
            registration.setNickname(nickname);
            registration = registrationRepository.save(registration);
        }

        RegistrationOrderPointEntity junction = null;
        if (orderPoint != null) {
            junction = ensureJunction(registration, orderPoint, event);
        }

        return registrationMapper.toDto(registration, junction);
    }

    private RegistrationOrderPointEntity ensureJunction(RegistrationEntity registration, OrderPointEntity orderPoint, EventEntity event) {
        Optional<RegistrationOrderPointEntity> existing =
                registrationOrderPointRepository.findByRegistrationIdAndOrderPointId(registration.getId(), orderPoint.getId());
        if (existing.isPresent()) {
            RegistrationOrderPointEntity junction = existing.get();
            ValidationStatus required = computeRequiredValidationStatus(event);
            // Auto-approve stale PENDING junctions if the event no longer requires validation.
            if (junction.getValidationStatus() == ValidationStatus.PENDING && required == ValidationStatus.APPROVED) {
                junction = markJunctionApproved(junction, "system:auto-approved");
            }
            return junction;
        }

        RegistrationOrderPointEntity junction = new RegistrationOrderPointEntity();
        junction.setRegistration(registration);
        junction.setOrderPoint(orderPoint);
        junction.setValidationStatus(computeRequiredValidationStatus(event));
        junction = registrationOrderPointRepository.save(junction);

        if (junction.getValidationStatus() == ValidationStatus.PENDING) {
            registrationNotificationService.notifyValidationRequested(registration, junction);
        }
        return junction;
    }

    /**
     * Validation has been removed as a feature — every junction is auto-approved.
     * Kept as a hook so per-event validation can be re-enabled later.
     */
    private ValidationStatus computeRequiredValidationStatus(EventEntity event) {
        return ValidationStatus.APPROVED;
    }

    private RegistrationOrderPointEntity markJunctionApproved(RegistrationOrderPointEntity junction, String approvedBy) {
        junction.setValidationStatus(ValidationStatus.APPROVED);
        junction.setApprovedBy(approvedBy);
        junction.setApprovedAt(LocalDateTime.now());
        RegistrationOrderPointEntity saved = registrationOrderPointRepository.save(junction);
        registrationNotificationService.notifyRegistrationApproved(saved.getRegistration(), saved);
        return saved;
    }

    public Registration getRegistration(UUID registrationId) {
        return getRegistration(registrationId, null);
    }

    public Registration getRegistration(UUID registrationId, UUID orderPointId) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
        RegistrationOrderPointEntity junction = orderPointId == null
                ? null
                : registrationOrderPointRepository.findByRegistrationIdAndOrderPointId(registrationId, orderPointId).orElse(null);
        return registrationMapper.toDto(registration, junction);
    }

    public Registration getWaiterRegistration(UUID eventId, String username) {
        RegistrationEntity registration = registrationRepository.findByEventIdAndUserUsername(eventId, username)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "WaiterRegistration", "event=" + eventId + ", user=" + username));
        return registrationMapper.toDto(registration, null);
    }

    public List<Registration> getPendingRegistrations(UUID eventId) {
        return registrationOrderPointRepository
                .findByRegistrationEventIdAndValidationStatus(eventId, ValidationStatus.PENDING)
                .stream()
                .map(j -> registrationMapper.toDto(j.getRegistration(), j))
                .toList();
    }

    public List<Registration> getPendingRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationOrderPointRepository
                .findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.PENDING)
                .stream()
                .filter(j -> !j.getRegistration().getId().equals(excludeRegistrationId))
                .map(j -> registrationMapper.toDto(j.getRegistration(), j))
                .toList();
    }

    public List<Registration> getApprovedRegistrationsForOrderPoint(UUID orderPointId, UUID excludeRegistrationId) {
        return registrationOrderPointRepository
                .findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED)
                .stream()
                .filter(j -> !j.getRegistration().getId().equals(excludeRegistrationId))
                .map(j -> registrationMapper.toDto(j.getRegistration(), j))
                .toList();
    }

    @Transactional
    public Registration approveRegistration(UUID registrationId, UUID orderPointId, String approvedBy) {
        RegistrationOrderPointEntity junction = registrationOrderPointRepository
                .findByRegistrationIdAndOrderPointId(registrationId, orderPointId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "RegistrationOrderPoint", "registration=" + registrationId + ", orderPoint=" + orderPointId));
        return registrationMapper.toDto(junction.getRegistration(), markJunctionApproved(junction, approvedBy));
    }

    @Transactional
    public Registration approveRegistrationByClient(UUID registrationId, UUID orderPointId, UUID approverRegistrationId) {
        RegistrationOrderPointEntity approverJunction = registrationOrderPointRepository
                .findByRegistrationIdAndOrderPointId(approverRegistrationId, orderPointId)
                .orElseThrow(() -> new BusinessException("Approver is not registered at this order point"));

        if (approverJunction.getValidationStatus() != ValidationStatus.APPROVED) {
            throw new UnauthorizedAccessException("Only approved registrations can approve others");
        }

        RegistrationOrderPointEntity targetJunction = registrationOrderPointRepository
                .findByRegistrationIdAndOrderPointId(registrationId, orderPointId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "RegistrationOrderPoint", "registration=" + registrationId + ", orderPoint=" + orderPointId));

        return registrationMapper.toDto(targetJunction.getRegistration(),
                markJunctionApproved(targetJunction, "client:" + approverRegistrationId));
    }

    public UUID getEventIdByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(r -> r.getEvent().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

    public String getNicknameByRegistrationId(UUID registrationId) {
        return registrationRepository.findById(registrationId)
                .map(RegistrationEntity::getNickname)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));
    }

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
        return registrationOrderPointRepository
                .findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED).stream()
                .map(RegistrationOrderPointEntity::getRegistration)
                .filter(r -> r.getCustomer() != null)
                .findFirst()
                .map(r -> new String[]{r.getCustomer().getFirstName(), r.getCustomer().getLastName()})
                .orElse(new String[]{"Guest", "Customer"});
    }

    @Transactional
    public Registration updateRegistrationCustomer(UUID registrationId, Customer customerInfo) {
        RegistrationEntity registration = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration", registrationId));

        if (customerInfo != null && customerInfo.getPrefix() != null && customerInfo.getPhone() != null) {
            Customer createdCustomer = customerService.findOrCreateCustomer(customerInfo);
            CustomerEntity customer = customerService.getCustomerEntity(createdCustomer.getId());
            registration.setCustomer(customer);
            registration = registrationRepository.save(registration);
        }

        return registrationMapper.toDto(registration, null);
    }
}
