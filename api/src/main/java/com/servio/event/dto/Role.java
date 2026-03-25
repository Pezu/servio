package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    private UUID id;
    private String name;
    private String description;
    private boolean active;
    private Set<String> permissions = new HashSet<>();
}