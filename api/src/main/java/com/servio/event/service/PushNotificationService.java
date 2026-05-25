package com.servio.event.service;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import com.servio.event.entity.PushTokenEntity;
import com.servio.event.entity.RegistrationEntity.ValidationStatus;
import com.servio.event.entity.RegistrationOrderPointEntity;
import com.servio.event.repository.PushTokenRepository;
import com.servio.event.repository.RegistrationOrderPointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService {

    private final FirebaseMessaging firebaseMessaging;
    private final PushTokenRepository pushTokenRepository;
    private final RegistrationOrderPointRepository registrationOrderPointRepository;

    @Value("${firebase.enabled:true}")
    private boolean firebaseEnabled;

    /**
     * Push a notification to every approved waiter assigned to the given order point.
     * Runs async — never block the calling transaction listener on FCM round-trips.
     * Dead tokens (UNREGISTERED / INVALID_ARGUMENT) are pruned from the database.
     */
    @Async("eventExecutor")
    @Transactional
    public void notifyOrderPointWaiters(UUID orderPointId, String title, String body, Map<String, String> data) {
        log.info("FCM dispatch: orderPoint={}, title='{}', enabled={}", orderPointId, title, firebaseEnabled);
        if (!firebaseEnabled || orderPointId == null) {
            log.info("FCM skip: enabled={} orderPointId={}", firebaseEnabled, orderPointId);
            return;
        }

        List<UUID> userIds = registrationOrderPointRepository
                .findByOrderPointIdAndValidationStatus(orderPointId, ValidationStatus.APPROVED)
                .stream()
                .map(RegistrationOrderPointEntity::getRegistration)
                .map(reg -> reg.getUser() != null ? reg.getUser().getId() : null)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        log.info("FCM target users: {} for orderPoint={}", userIds.size(), orderPointId);

        if (userIds.isEmpty()) {
            log.info("FCM skip: no approved waiters with users on orderPoint={}", orderPointId);
            return;
        }

        List<PushTokenEntity> tokens = pushTokenRepository.findByUserIdIn(userIds);
        log.info("FCM target tokens: {} for {} users", tokens.size(), userIds.size());
        if (tokens.isEmpty()) {
            log.info("FCM skip: no push tokens for {} waiters of orderPoint={}", userIds.size(), orderPointId);
            return;
        }

        List<String> tokenStrings = tokens.stream().map(PushTokenEntity::getToken).toList();
        log.info("Sending FCM to {} tokens (orderPoint={}, title='{}')", tokenStrings.size(), orderPointId, title);

        MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokenStrings)
                .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                .putAllData(data == null ? Map.of() : data)
                .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder()
                                .setChannelId("orders")
                                .setDefaultSound(true)
                                .setDefaultVibrateTimings(true)
                                .build())
                        .build())
                .setApnsConfig(ApnsConfig.builder()
                        .setAps(Aps.builder().setSound("default").build())
                        .build())
                .build();

        try {
            BatchResponse response = firebaseMessaging.sendEachForMulticast(message);
            handleFailures(response, tokenStrings);
        } catch (FirebaseMessagingException e) {
            log.error("FCM batch send failed: {}", e.getMessage(), e);
        }
    }

    private void handleFailures(BatchResponse response, List<String> tokens) {
        if (response.getFailureCount() == 0) return;
        List<String> deadTokens = new ArrayList<>();
        List<SendResponse> responses = response.getResponses();
        for (int i = 0; i < responses.size(); i++) {
            SendResponse r = responses.get(i);
            if (r.isSuccessful()) continue;
            MessagingErrorCode code = r.getException().getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                deadTokens.add(tokens.get(i));
            } else {
                log.warn("FCM send failed for token (kept): {} — {}", tokens.get(i), code);
            }
        }
        if (!deadTokens.isEmpty()) {
            log.info("Pruning {} dead push tokens", deadTokens.size());
            pushTokenRepository.deleteAllById(deadTokens);
        }
    }

    /** Convenience for callers that don't need extra data fields. */
    public void notifyOrderPointWaiters(UUID orderPointId, String title, String body) {
        notifyOrderPointWaiters(orderPointId, title, body, Collections.emptyMap());
    }
}
