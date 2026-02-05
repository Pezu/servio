package com.tapello.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Location {
    private UUID id;
    private String name;
    private UUID clientId;
    private UUID parentId;
    private String parentName;
}