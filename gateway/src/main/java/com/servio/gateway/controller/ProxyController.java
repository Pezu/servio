package com.servio.gateway.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Enumeration;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
public class ProxyController {

    @Value("${services.event-api.url}")
    private String eventApiUrl;

    @Value("${services.order-service.url}")
    private String orderServiceUrl;

    private final RestTemplate restTemplate;

    public ProxyController() {
        // Use Apache HttpClient with extended timeouts for file uploads
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.of(60, TimeUnit.SECONDS))
                .setResponseTimeout(Timeout.of(60, TimeUnit.SECONDS))
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .build();

        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(httpClient);
        requestFactory.setConnectTimeout(60000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    /**
     * Proxy all order requests to Event API (handles WebSocket notifications)
     */
    @RequestMapping(value = "/api/orders/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<byte[]> proxyOrders(HttpServletRequest request) throws IOException, URISyntaxException {
        return proxyRequest(request, eventApiUrl);
    }

    @RequestMapping(value = "/api/orders", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<byte[]> proxyOrdersBase(HttpServletRequest request) throws IOException, URISyntaxException {
        return proxyRequest(request, eventApiUrl);
    }

    /**
     * Proxy payment requests to Event API
     */
    @RequestMapping(value = "/api/payments/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<byte[]> proxyPayments(HttpServletRequest request) throws IOException, URISyntaxException {
        return proxyRequest(request, eventApiUrl);
    }

    /**
     * Proxy all other /api/** requests to Event API
     */
    @RequestMapping(value = "/api/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<byte[]> proxyEventApi(HttpServletRequest request) throws IOException, URISyntaxException {
        return proxyRequest(request, eventApiUrl);
    }

    private ResponseEntity<byte[]> proxyRequest(HttpServletRequest request, String targetBaseUrl) throws IOException, URISyntaxException {
        String requestUri = request.getRequestURI();
        String queryString = request.getQueryString();
        String targetUrl = targetBaseUrl + requestUri + (queryString != null ? "?" + queryString : "");

        log.debug("Proxying {} {} to {}", request.getMethod(), requestUri, targetUrl);

        // Read request body first
        byte[] body = StreamUtils.copyToByteArray(request.getInputStream());

        // Build headers
        HttpHeaders headers = new HttpHeaders();
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            // Skip hop-by-hop headers and Content-Length (we'll set it ourselves)
            if (!headerName.equalsIgnoreCase("Host") &&
                !headerName.equalsIgnoreCase("Connection") &&
                !headerName.equalsIgnoreCase("Transfer-Encoding") &&
                !headerName.equalsIgnoreCase("Content-Length")) {
                headers.add(headerName, request.getHeader(headerName));
            }
        }

        // Set correct Content-Length based on actual body size
        if (body.length > 0) {
            headers.setContentLength(body.length);
        }

        // Add user info from JWT (if authenticated)
        Object userId = request.getAttribute("X-User-Id");
        Object username = request.getAttribute("X-Username");
        Object role = request.getAttribute("X-User-Role");
        Object clientId = request.getAttribute("X-Client-Id");

        if (userId != null) headers.set("X-User-Id", userId.toString());
        if (username != null) headers.set("X-Username", username.toString());
        if (role != null) headers.set("X-User-Role", role.toString());
        if (clientId != null) headers.set("X-Client-Id", clientId.toString());

        HttpEntity<byte[]> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    new URI(targetUrl),
                    HttpMethod.valueOf(request.getMethod()),
                    entity,
                    byte[].class
            );

            // Build response headers (skip CORS headers - gateway handles them)
            HttpHeaders responseHeaders = filterResponseHeaders(response.getHeaders());
            return new ResponseEntity<>(response.getBody(), responseHeaders, response.getStatusCode());

        } catch (HttpStatusCodeException e) {
            log.debug("Backend returned error: {} {}", e.getStatusCode(), e.getStatusText());
            HttpHeaders responseHeaders = filterResponseHeaders(e.getResponseHeaders());
            return new ResponseEntity<>(e.getResponseBodyAsByteArray(), responseHeaders, e.getStatusCode());
        }
    }

    private HttpHeaders filterResponseHeaders(HttpHeaders headers) {
        HttpHeaders filtered = new HttpHeaders();
        if (headers == null) return filtered;

        headers.forEach((name, values) -> {
            // Skip hop-by-hop and CORS headers (gateway handles CORS)
            if (!name.equalsIgnoreCase("Transfer-Encoding") &&
                !name.equalsIgnoreCase("Access-Control-Allow-Origin") &&
                !name.equalsIgnoreCase("Access-Control-Allow-Methods") &&
                !name.equalsIgnoreCase("Access-Control-Allow-Headers") &&
                !name.equalsIgnoreCase("Access-Control-Allow-Credentials") &&
                !name.equalsIgnoreCase("Access-Control-Expose-Headers") &&
                !name.equalsIgnoreCase("Access-Control-Max-Age") &&
                !name.equalsIgnoreCase("Vary")) {
                filtered.addAll(name, values);
            }
        });
        return filtered;
    }
}
