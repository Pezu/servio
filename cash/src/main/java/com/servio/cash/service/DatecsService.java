package com.servio.cash.service;

import com.servio.cash.dto.ReceiptItem;
import com.servio.cash.dto.ReceiptRequest;
import com.servio.cash.dto.ReceiptResponse;
import com.servio.cash.protocol.DatecsProtocol;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class DatecsService {

    @Value("${datecs.host:192.168.0.231}")
    private String datecsHost;

    @Value("${datecs.port:4999}")
    private int datecsPort;

    @Value("${datecs.timeout:5000}")
    private int socketTimeout;

    private final DatecsProtocol protocol = new DatecsProtocol();

    public ReceiptResponse printFiscalReceipt(ReceiptRequest request) {
        List<String> errors = new ArrayList<>();
        String fiscalNumber = null;
        String receiptNumber = null;

        try (Socket socket = new Socket(datecsHost, datecsPort)) {
            socket.setSoTimeout(socketTimeout);

            OutputStream out = socket.getOutputStream();
            InputStream in = socket.getInputStream();

            protocol.resetSequence();

            // 1. Open fiscal receipt
            String openReceiptData = buildOpenReceiptData(request);
            DatecsProtocol.DatecsResponse openResponse = sendCommand(out, in,
                    DatecsProtocol.CMD_OPEN_FISCAL_RECEIPT, openReceiptData);

            if (!openResponse.success()) {
                return ReceiptResponse.builder()
                        .success(false)
                        .message("Failed to open fiscal receipt: " + openResponse.message())
                        .build();
            }

            // 2. Register each item
            for (ReceiptItem item : request.getItems()) {
                String saleData = buildSaleData(item);
                DatecsProtocol.DatecsResponse saleResponse = sendCommand(out, in,
                        DatecsProtocol.CMD_REGISTER_SALE, saleData);

                if (!saleResponse.success()) {
                    errors.add("Failed to register item " + item.getName() + ": " + saleResponse.message());
                }
            }

            // 3. Calculate subtotal
            DatecsProtocol.DatecsResponse subtotalResponse = sendCommand(out, in,
                    DatecsProtocol.CMD_SUBTOTAL, "");

            // 4. Payment
            String paymentData = buildPaymentData(request);
            DatecsProtocol.DatecsResponse paymentResponse = sendCommand(out, in,
                    DatecsProtocol.CMD_PAYMENT, paymentData);

            if (!paymentResponse.success()) {
                return ReceiptResponse.builder()
                        .success(false)
                        .message("Failed to process payment: " + paymentResponse.message())
                        .build();
            }

            // 5. Close fiscal receipt
            DatecsProtocol.DatecsResponse closeResponse = sendCommand(out, in,
                    DatecsProtocol.CMD_CLOSE_FISCAL_RECEIPT, "");

            if (closeResponse.success() && closeResponse.dataParts() != null && closeResponse.dataParts().length > 0) {
                // Parse fiscal number from response
                fiscalNumber = closeResponse.dataParts()[0];
                if (closeResponse.dataParts().length > 1) {
                    receiptNumber = closeResponse.dataParts()[1];
                }
            }

            boolean overallSuccess = errors.isEmpty();
            return ReceiptResponse.builder()
                    .success(overallSuccess)
                    .message(overallSuccess ? "Receipt printed successfully" : String.join("; ", errors))
                    .fiscalNumber(fiscalNumber)
                    .receiptNumber(receiptNumber)
                    .rawResponse(closeResponse.rawData())
                    .build();

        } catch (SocketTimeoutException e) {
            log.error("Timeout communicating with Datecs device at {}:{}", datecsHost, datecsPort, e);
            return ReceiptResponse.builder()
                    .success(false)
                    .message("Connection timeout to cash register")
                    .build();
        } catch (IOException e) {
            log.error("IO error communicating with Datecs device at {}:{}", datecsHost, datecsPort, e);
            return ReceiptResponse.builder()
                    .success(false)
                    .message("Communication error: " + e.getMessage())
                    .build();
        }
    }

    private DatecsProtocol.DatecsResponse sendCommand(OutputStream out, InputStream in,
                                                       int command, String data) throws IOException {
        byte[] commandBytes = protocol.buildCommand(command, data);
        log.debug("Sending command {}: {}", command, data);

        out.write(commandBytes);
        out.flush();

        // Wait for response
        byte[] responseBuffer = new byte[1024];
        int bytesRead = in.read(responseBuffer);

        if (bytesRead <= 0) {
            return new DatecsProtocol.DatecsResponse(false, "No response received", null, null);
        }

        byte[] response = new byte[bytesRead];
        System.arraycopy(responseBuffer, 0, response, 0, bytesRead);

        return protocol.parseResponse(response);
    }

    private String buildOpenReceiptData(ReceiptRequest request) {
        // Format: <OperatorCode>,<OperatorPassword>,<TillNumber>,<UNP>
        StringBuilder sb = new StringBuilder();
        sb.append(request.getOperatorCode() != null ? request.getOperatorCode() : "1");
        sb.append(",");
        sb.append(request.getOperatorPassword() != null ? request.getOperatorPassword() : "1");
        sb.append(",");
        sb.append(request.getTillNumber() != null ? request.getTillNumber() : 1);

        if (request.getUniqueSaleNumber() != null && !request.getUniqueSaleNumber().isEmpty()) {
            sb.append(",");
            sb.append(request.getUniqueSaleNumber());
        }

        return sb.toString();
    }

    private String buildSaleData(ReceiptItem item) {
        // Format: <Name>\t<VATgroup><Price>[*<Quantity>]
        StringBuilder sb = new StringBuilder();
        sb.append(item.getName());
        sb.append("\t");
        sb.append(item.getVatGroup() != null ? item.getVatGroup() : "A");
        sb.append(formatPrice(item.getPrice()));

        if (item.getQuantity() != null && item.getQuantity().compareTo(BigDecimal.ONE) != 0) {
            sb.append("*");
            sb.append(formatQuantity(item.getQuantity()));
        }

        return sb.toString();
    }

    private String buildPaymentData(ReceiptRequest request) {
        // Format: <PaymentType>\t<Amount>
        int paymentType = switch (request.getPaymentType()) {
            case CASH -> 0;
            case CARD -> 1;
            case CREDIT -> 2;
            case CHECK -> 3;
            case COUPON -> 4;
            case null -> 0;
        };

        StringBuilder sb = new StringBuilder();
        sb.append("\t");
        sb.append(paymentType);

        if (request.getPaymentAmount() != null) {
            sb.append("\t");
            sb.append(formatPrice(request.getPaymentAmount()));
        }

        return sb.toString();
    }

    private String formatPrice(BigDecimal price) {
        if (price == null) return "0.00";
        return price.setScale(2, java.math.RoundingMode.HALF_UP).toString();
    }

    private String formatQuantity(BigDecimal quantity) {
        if (quantity == null) return "1";
        return quantity.stripTrailingZeros().toPlainString();
    }
}
