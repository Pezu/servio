package com.servio.event.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Minimal projection of an order point used in dropdowns / pick lists. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderPointSummary {
    private UUID id;
    private String name;
}
