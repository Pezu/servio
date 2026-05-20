package com.servio.cash.protocol;

import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;

@Slf4j
public class DatecsProtocol {

    private static final Charset WINDOWS_1251 = Charset.forName("windows-1251");

    // Frame structure constants
    private static final byte PREAMBLE = 0x01;
    private static final byte POSTAMBLE = 0x05;
    private static final byte TERMINATOR = 0x03;
    private static final int LENGTH_OFFSET = 0x20;
    private static final int SEQ_OFFSET = 0x20;

    // Command codes
    public static final int CMD_OPEN_FISCAL_RECEIPT = 48;      // 0x30
    public static final int CMD_REGISTER_SALE = 49;            // 0x31
    public static final int CMD_SUBTOTAL = 51;                 // 0x33
    public static final int CMD_PAYMENT = 53;                  // 0x35
    public static final int CMD_CLOSE_FISCAL_RECEIPT = 56;     // 0x38
    public static final int CMD_GET_STATUS = 74;               // 0x4A
    public static final int CMD_GET_DIAGNOSTIC_INFO = 90;      // 0x5A
    public static final int CMD_OPEN_NON_FISCAL_RECEIPT = 38;  // 0x26
    public static final int CMD_CLOSE_NON_FISCAL_RECEIPT = 39; // 0x27
    public static final int CMD_PRINT_FREE_TEXT = 42;          // 0x2A

    private int sequenceNumber = 0x20;

    public byte[] buildCommand(int command, String data) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        byte[] dataBytes = data != null ? data.getBytes(WINDOWS_1251) : new byte[0];

        // Calculate length: data length + 10 (fixed overhead) + 0x20 offset
        // Overhead includes: 1 (seq) + 1 (cmd) + data + 1 (postamble) = length of message body
        int length = 1 + 1 + dataBytes.length + 1 + LENGTH_OFFSET;

        // Build frame
        baos.write(PREAMBLE);
        baos.write(length);
        baos.write(getNextSequence());
        baos.write(command);

        // Write data
        for (byte b : dataBytes) {
            baos.write(b);
        }

        baos.write(POSTAMBLE);

        // Calculate BCC (checksum)
        byte[] frameWithoutBcc = baos.toByteArray();
        int bcc = calculateBcc(frameWithoutBcc);

        // Write BCC as 4 ASCII-hex characters (each nibble + 0x30)
        baos.write(((bcc >> 12) & 0x0F) + 0x30);
        baos.write(((bcc >> 8) & 0x0F) + 0x30);
        baos.write(((bcc >> 4) & 0x0F) + 0x30);
        baos.write((bcc & 0x0F) + 0x30);

        baos.write(TERMINATOR);

        byte[] result = baos.toByteArray();
        log.debug("Built command: {} - {}", command, bytesToHex(result));
        return result;
    }

    private int calculateBcc(byte[] frame) {
        int bcc = 0;
        // Sum all bytes from length (index 1) to postamble (last byte)
        for (int i = 1; i < frame.length; i++) {
            bcc += (frame[i] & 0xFF);
        }
        return bcc;
    }

    private int getNextSequence() {
        int seq = sequenceNumber;
        sequenceNumber++;
        if (sequenceNumber > 0x7F) {
            sequenceNumber = 0x20;
        }
        return seq;
    }

    public void resetSequence() {
        sequenceNumber = 0x20;
    }

    public DatecsResponse parseResponse(byte[] response) {
        if (response == null || response.length < 10) {
            return new DatecsResponse(false, "Invalid response length", null, null);
        }

        // Find preamble
        int startIndex = -1;
        for (int i = 0; i < response.length; i++) {
            if (response[i] == PREAMBLE) {
                startIndex = i;
                break;
            }
        }

        if (startIndex == -1) {
            return new DatecsResponse(false, "No preamble found", null, null);
        }

        // Find terminator
        int endIndex = -1;
        for (int i = startIndex; i < response.length; i++) {
            if (response[i] == TERMINATOR) {
                endIndex = i;
                break;
            }
        }

        if (endIndex == -1) {
            return new DatecsResponse(false, "No terminator found", null, null);
        }

        // Parse frame
        int length = (response[startIndex + 1] & 0xFF) - LENGTH_OFFSET;
        int seq = response[startIndex + 2] & 0xFF;
        int cmd = response[startIndex + 3] & 0xFF;

        // Find postamble
        int postambleIndex = -1;
        for (int i = startIndex + 4; i < endIndex - 4; i++) {
            if (response[i] == POSTAMBLE) {
                postambleIndex = i;
                break;
            }
        }

        if (postambleIndex == -1) {
            return new DatecsResponse(false, "No postamble found", null, null);
        }

        // Extract data
        byte[] dataBytes = new byte[postambleIndex - startIndex - 4];
        System.arraycopy(response, startIndex + 4, dataBytes, 0, dataBytes.length);
        String data = new String(dataBytes, WINDOWS_1251);

        // Extract status bytes (6 bytes after data, before postamble)
        // In Datecs protocol, status is embedded in the data section
        String[] parts = data.split("\t");

        log.debug("Parsed response - cmd: {}, data: {}", cmd, data);

        return new DatecsResponse(true, "OK", data, parts);
    }

    public record DatecsResponse(boolean success, String message, String rawData, String[] dataParts) {
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }
}
