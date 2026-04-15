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
import org.springframework.util.AntPathMatcher;
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

    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    // Public endpoints that don't require authentication
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/login",
            "/api/register/**",
            "/api/payments/**",
            "/api/images/**",
            "/api/events/customer",
            "/api/allergens/active",
            "/api/events/*/menu",
            "/api/menu/menus/*/tree",
            "/api/orders/registrations/**",
            "/api/orders/*/confirm",
            "/api/orders/order-points/**",
            "/api/orders/events/*/needs-payment",
            "/ws/**",
            "/api/internal/**",
            "/health",
            "/actuator/**"
    );

    // Paths that allow GET without auth
    private static final List<String> PUBLIC_GET_PATHS = List.of(
            "/api/events/*"
    );

    // Paths that allow POST without auth
    private static final List<String> PUBLIC_POST_PATHS = List.of(
            "/api/orders"
    );

    private boolean isPublicPath(String path, String method) {
        for (String pattern : PUBLIC_PATHS) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        if ("GET".equalsIgnoreCase(method)) {
            for (String pattern : PUBLIC_GET_PATHS) {
                if (pathMatcher.match(pattern, path)) {
                    return true;
                }
            }
        }
        if ("POST".equalsIgnoreCase(method)) {
            for (String pattern : PUBLIC_POST_PATHS) {
                if (pathMatcher.match(pattern, path)) {
                    return true;
                }
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();
        String authHeader = request.getHeader("Authorization");

        boolean isPublic = isPublicPath(path, method);
        System.out.println(">>> JwtFilter: path=" + path + " method=" + method + " isPublic=" + isPublic);

        // Allow public paths without authentication
        if (isPublicPath(path, method)) {
            // Still try to parse JWT if present (for optional auth)
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                trySetAuthentication(authHeader.substring(7), request);
            }
            filterChain.doFilter(request, response);
            return;
        }

        // For protected paths, require valid JWT
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\": \"Missing or invalid Authorization header\"}");
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

    private void trySetAuthentication(String token, HttpServletRequest request) {
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

            String role = claims.get("role", String.class);
            if (role == null) {
                @SuppressWarnings("unchecked")
                List<String> roles = claims.get("roles", List.class);
                if (roles != null && !roles.isEmpty()) {
                    role = roles.get(0);
                }
            }

            request.setAttribute("X-User-Id", userId);
            request.setAttribute("X-Username", username != null ? username : userId);
            request.setAttribute("X-User-Role", role);
            if (clientId != null) {
                request.setAttribute("X-Client-Id", clientId);
            }

            List<SimpleGrantedAuthority> authorities = role != null
                    ? Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
                    : Collections.emptyList();
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userId, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception e) {
            // Ignore - optional auth on public paths
            log.debug("Optional JWT parsing failed on public path: {}", e.getMessage());
        }
    }
}
