package com.servio.event.web;

import com.servio.event.dto.PushTokenRegisterRequest;
import com.servio.event.entity.PushTokenEntity;
import com.servio.event.entity.UserEntity;
import com.servio.event.repository.PushTokenRepository;
import com.servio.event.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Slf4j
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushTokenController {

    private final PushTokenRepository pushTokenRepository;
    private final UserRepository userRepository;

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<Void> register(@Valid @RequestBody PushTokenRegisterRequest request) {
        UserEntity user = currentUser();

        Instant now = Instant.now();
        PushTokenEntity entity = pushTokenRepository.findById(request.getToken()).orElse(null);
        if (entity == null) {
            entity = new PushTokenEntity();
            entity.setToken(request.getToken());
            entity.setCreatedAt(now);
            log.info("Registering new push token for user={} platform={}", user.getUsername(), request.getPlatform());
        } else {
            log.debug("Refreshing existing push token for user={}", user.getUsername());
        }
        entity.setUser(user);
        entity.setPlatform(request.getPlatform());
        entity.setLastSeenAt(now);
        pushTokenRepository.save(entity);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/unregister/{token}")
    @Transactional
    public ResponseEntity<Void> unregister(@PathVariable String token) {
        pushTokenRepository.deleteByToken(token);
        return ResponseEntity.noContent().build();
    }

    // The JWT subject is the username, not a UUID — resolve to the entity.
    private UserEntity currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            throw new IllegalStateException("No authenticated principal");
        }
        String principal = auth.getPrincipal().toString();
        return userRepository.findByUsername(principal)
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + principal));
    }
}
