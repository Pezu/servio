package com.servio.event.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PushTokenRegisterRequest {

    @NotBlank
    private String token;

    @NotBlank
    @Pattern(regexp = "android|ios|web", message = "platform must be one of: android, ios, web")
    private String platform;
}
