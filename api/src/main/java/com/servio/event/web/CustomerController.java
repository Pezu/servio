package com.servio.event.web;

import com.servio.event.dto.Customer;
import com.servio.event.service.CustomerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @PostMapping
    public ResponseEntity<Customer> createOrFindCustomer(@RequestBody Customer request) {
        Customer customer = customerService.findOrCreateCustomer(request);
        return ResponseEntity.ok(customer);
    }

    @GetMapping("/{customerId}")
    public ResponseEntity<Customer> getCustomer(@PathVariable UUID customerId) {
        Customer customer = customerService.getCustomer(customerId);
        return ResponseEntity.ok(customer);
    }
}
