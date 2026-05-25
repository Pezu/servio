package com.servio.event.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Slf4j
@Configuration
public class FirebaseConfig {

    @Value("${firebase.credentials-path:}")
    private String credentialsPath;

    @Value("${firebase.credentials-json:}")
    private String credentialsJson;

    @Value("${firebase.project-id:}")
    private String projectId;

    @Bean
    public FirebaseMessaging firebaseMessaging() throws Exception {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseMessaging.getInstance(FirebaseApp.getInstance());
        }

        GoogleCredentials credentials;
        if (!credentialsJson.isBlank()) {
            log.info("Initializing Firebase from FIREBASE_CREDENTIALS_JSON env var");
            try (InputStream stream = new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8))) {
                credentials = GoogleCredentials.fromStream(stream);
            }
        } else if (!credentialsPath.isBlank()) {
            log.info("Initializing Firebase from credentials file: {}", credentialsPath);
            try (InputStream stream = new FileInputStream(credentialsPath)) {
                credentials = GoogleCredentials.fromStream(stream);
            }
        } else {
            // App-default credentials — useful on GCP runtimes (e.g. Cloud Run with
            // workload identity). Falls back to GOOGLE_APPLICATION_CREDENTIALS env.
            log.info("Initializing Firebase from application-default credentials");
            credentials = GoogleCredentials.getApplicationDefault();
        }

        FirebaseOptions.Builder builder = FirebaseOptions.builder().setCredentials(credentials);
        // ADC on Cloud Run doesn't carry a project ID and Cloud Run doesn't set
        // GOOGLE_CLOUD_PROJECT by default — FirebaseMessaging needs it explicitly.
        String resolvedProjectId = !projectId.isBlank()
                ? projectId
                : System.getenv("GOOGLE_CLOUD_PROJECT");
        if (resolvedProjectId != null && !resolvedProjectId.isBlank()) {
            log.info("Firebase project ID: {}", resolvedProjectId);
            builder.setProjectId(resolvedProjectId);
        }
        FirebaseApp app = FirebaseApp.initializeApp(builder.build());
        return FirebaseMessaging.getInstance(app);
    }
}
