package com.servio.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

@Slf4j
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String userId = claims.getSubject();
            String username = claims.get("username", String.class);
            String clientId = claims.get("clientId", String.class);

            // Handle both "role" (singular) and "roles" (array) formats
            String role = claims.get("role", String.class);
            if (role == null) {
                @SuppressWarnings("unchecked")
                List<String> roles = claims.get("roles", List.class);
                if (roles != null && !roles.isEmpty()) {
                    role = roles.get(0);
                }
            }

            // Store in request attributes for downstream services
            request.setAttribute("X-User-Id", userId);
            request.setAttribute("X-Username", username != null ? username : userId);
            request.setAttribute("X-User-Role", role);
            if (clientId != null) {
                request.setAttribute("X-Client-Id", clientId);
            }

            // Set Spring Security context
            List<SimpleGrantedAuthority> authorities = role != null
                    ? Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
                    : Collections.emptyList();
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userId,
                    null,
                    authorities
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("JWT validated for user: {}, role: {}", username != null ? username : userId, role);

        } catch (ExpiredJwtException e) {
            log.warn("JWT token expired");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Token expired\"}");
            return;
        } catch (MalformedJwtException | SignatureException e) {
            log.warn("Invalid JWT token");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Invalid token\"}");
            return;
        } catch (Exception e) {
            log.error("JWT validation error", e);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Authentication failed\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
