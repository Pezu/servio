package com.servio.event.service;

import com.servio.event.dto.Customer;
import com.servio.event.entity.CustomerEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;

    @Transactional
    public Customer findOrCreateCustomer(Customer customerInfo) {
        CustomerEntity entity = customerRepository.findByPrefixAndPhone(customerInfo.getPrefix(), customerInfo.getPhone())
                .map(existing -> {
                    // Update existing customer info if changed
                    boolean updated = false;
                    if (customerInfo.getFirstName() != null && !customerInfo.getFirstName().equals(existing.getFirstName())) {
                        existing.setFirstName(customerInfo.getFirstName());
                        updated = true;
                    }
                    if (customerInfo.getLastName() != null && !customerInfo.getLastName().equals(existing.getLastName())) {
                        existing.setLastName(customerInfo.getLastName());
                        updated = true;
                    }
                    if (customerInfo.getEmail() != null && !customerInfo.getEmail().equals(existing.getEmail())) {
                        existing.setEmail(customerInfo.getEmail());
                        updated = true;
                    }
                    return updated ? customerRepository.save(existing) : existing;
                })
                .orElseGet(() -> {
                    CustomerEntity newCustomer = CustomerEntity.builder()
                            .firstName(customerInfo.getFirstName())
                            .lastName(customerInfo.getLastName())
                            .prefix(customerInfo.getPrefix())
                            .phone(customerInfo.getPhone())
                            .email(customerInfo.getEmail())
                            .build();
                    return customerRepository.save(newCustomer);
                });

        log.info("Found/created customer: {}", entity.getId());
        return toDto(entity);
    }

    public Customer getCustomer(UUID customerId) {
        CustomerEntity entity = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId));
        return toDto(entity);
    }

    public CustomerEntity getCustomerEntity(UUID customerId) {
        return customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId));
    }

    private Customer toDto(CustomerEntity entity) {
        return Customer.builder()
                .id(entity.getId())
                .firstName(entity.getFirstName())
                .lastName(entity.getLastName())
                .prefix(entity.getPrefix())
                .phone(entity.getPhone())
                .email(entity.getEmail())
                .build();
    }
}
