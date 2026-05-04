package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Customer {
    private UUID id;
    private String firstName;
    private String lastName;
    private String prefix;
    private String phone;
    private String email;
}
