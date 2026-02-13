package com.tapello.event.dto;

import lombok.Data;

@Data
public class CreateOrderPointRequest {
    private String name;
    private boolean payLater;
}