package com.servio.event.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.XXssProtectionHeaderWriter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(@Lazy JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                        .contentTypeOptions(contentType -> {})
                        .frameOptions(frame -> frame.deny())
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'self'; frame-ancestors 'none'"))
                )
                .authorizeHttpRequests(auth -> auth
                        // Public authentication endpoints
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/register/**").permitAll()
                        // Public payment endpoints (webhooks)
                        .requestMatchers("/api/payments/**").permitAll()
                        // Public image endpoint
                        .requestMatchers("/api/images/**").permitAll()
                        // Public customer-facing endpoints
                        .requestMatchers("/api/events/customer").permitAll()
                        .requestMatchers("/api/allergens/active").permitAll()
                        // Customer-facing event details and menu (GET only)
                        .requestMatchers(HttpMethod.GET, "/api/events/{id}").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/events/{id}/menu").permitAll()
                        // Customer order endpoints
                        .requestMatchers(HttpMethod.POST, "/api/orders").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/registrations/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/orders/*/confirm").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/order-points/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/orders/events/*/needs-payment").permitAll()
                        // WebSocket endpoint
                        .requestMatchers("/ws/**").permitAll()
                        // Internal API endpoints (for Order microservice)
                        .requestMatchers("/api/internal/**").permitAll()
                        // Health check endpoints
                        .requestMatchers("/health").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        // All other requests require authentication
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            String origin = request.getHeader("Origin");
                            if (origin != null) {
                                response.setHeader("Access-Control-Allow-Origin", origin);
                                response.setHeader("Access-Control-Allow-Credentials", "true");
                            }
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Access denied\"}");
                        })
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}