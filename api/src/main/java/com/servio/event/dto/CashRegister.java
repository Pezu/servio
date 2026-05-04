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
public class CashRegister {
    private UUID id;
    private String name;
    private String ip;
    private String sharedToken;
}
