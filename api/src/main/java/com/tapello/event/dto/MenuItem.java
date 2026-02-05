package com.tapello.event.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuItem {
    private UUID id;
    @JsonIgnore
    private UUID locationId;
    @JsonIgnore
    private UUID clientId;
    @JsonIgnore
    private UUID parentId;
    private String name;
    private Boolean orderable;
    private BigDecimal price;
    private String imagePath;
    private String description;
    private List<MenuItem> children = new ArrayList<>();
}