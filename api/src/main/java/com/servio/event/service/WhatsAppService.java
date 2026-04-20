package com.servio.event.service;

import com.servio.event.config.TwilioProperties;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class WhatsAppService {

    private final TwilioProperties twilioProperties;

    @Async
    public void sendOrderReadyNotification(String customerPhone, String customerName, int orderNo, String orderPointName) {
        if (!twilioProperties.enabled()) {
            log.info("WhatsApp disabled. Would send to {}: Order #{} is ready", customerPhone, orderNo);
            return;
        }

        if (customerPhone == null || customerPhone.isBlank()) {
            log.warn("No phone number for order #{}, skipping WhatsApp notification", orderNo);
            return;
        }

        try {
            String toNumber = formatWhatsAppNumber(customerPhone);
            String body = String.format(
                    "Hi %s! 👋 Your order #%d is ready for pickup at %s. Enjoy! 🎉",
                    customerName != null ? customerName : "there",
                    orderNo,
                    orderPointName != null ? orderPointName : "the counter"
            );

            Message message = Message.creator(
                    new PhoneNumber(toNumber),
                    new PhoneNumber(twilioProperties.whatsappFrom()),
                    body
            ).create();

            log.info("WhatsApp sent to {} for order #{}: SID={}", toNumber, orderNo, message.getSid());
        } catch (Exception e) {
            log.error("Failed to send WhatsApp to {} for order #{}: {}", customerPhone, orderNo, e.getMessage());
        }
    }

    private String formatWhatsAppNumber(String phone) {
        String cleaned = phone.replaceAll("[^+\\d]", "");
        if (!cleaned.startsWith("+")) {
            cleaned = "+40" + cleaned;
        }
        return "whatsapp:" + cleaned;
    }
}
