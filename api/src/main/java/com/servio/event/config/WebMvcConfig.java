package com.servio.event.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

/**
 * Lets the Jackson converter also write under {@code application/javascript}.
 *
 * <p>The app exposes a SockJS endpoint (see {@link WebSocketConfig}). SockJS
 * streaming transports (eventsource / htmlfile) preset the response
 * {@code Content-Type} to {@code application/javascript;charset=UTF-8}. When
 * such a connection errors or drops mid-stream, Tomcat performs an
 * error-dispatch and Spring Boot's {@code BasicErrorController} returns a
 * {@code Map<String,Object>} body. The stock Jackson converter only advertises
 * {@code application/json} / {@code application/*+json}, so there is no
 * converter able to write that map under the already-preset
 * {@code application/javascript} type — yielding a noisy
 * {@code HttpMessageNotWritableException} ("No converter for [LinkedHashMap]
 * with preset Content-Type 'application/javascript'") and a follow-on failure
 * in the global {@code @ControllerAdvice}.
 *
 * <p>Teaching Jackson to also serialize under {@code application/javascript}
 * removes the log noise without affecting normal JSON responses.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        for (HttpMessageConverter<?> converter : converters) {
            if (converter instanceof MappingJackson2HttpMessageConverter jackson) {
                List<MediaType> supported = new ArrayList<>(jackson.getSupportedMediaTypes());
                MediaType appJs = MediaType.parseMediaType("application/javascript");
                if (!supported.contains(appJs)) {
                    supported.add(appJs);
                    jackson.setSupportedMediaTypes(supported);
                }
            }
        }
    }
}