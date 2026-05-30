package com.servio.event.service;

import com.servio.event.entity.UserEntity;
import com.servio.event.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
@RequiredArgsConstructor
public class LoginService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${jwt.secret:default-secret-key-that-should-be-changed-in-production}")
    private String jwtSecret;

    /** Token time-to-live in milliseconds. Defaults to 24h. */
    @Value("${jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    public String login(String username, String password) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid username or password");
        }

        return generateToken(user);
    }

    private String generateToken(UserEntity user) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        Date expiration = new Date(now.getTime() + jwtExpirationMs);

        var builder = Jwts.builder()
                .subject(user.getUsername())
                .claim("roles", user.getRoles())
                .issuedAt(now)
                .expiration(expiration);

        // Include clientId if user belongs to a client
        if (user.getClient() != null) {
            builder.claim("clientId", user.getClient().getId().toString());
        }

        return builder.signWith(key).compact();
    }
}