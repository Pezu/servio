package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {
    private UUID orderPointId;
    private String nickname;

    // For returning customers - just pass customerId
    private UUID customerId;

    // For new customers - pass full info
    private String firstName;
    private String lastName;
    private String prefix;
    private String phone;
    private String email;

    public Customer toCustomer() {
        if (prefix == null || phone == null) {
            return null;
        }
        return Customer.builder()
                .firstName(firstName)
                .lastName(lastName)
                .prefix(prefix)
                .phone(phone)
                .email(email)
                .build();
    }

    public boolean hasCustomerId() {
        return customerId != null;
    }

    public boolean hasCustomerInfo() {
        return prefix != null && phone != null;
    }
}
