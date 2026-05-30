package com.datecs.printerfpgate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO trimis inapoi catre cloud socket dupa tiparirea bonului fiscal.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReceiptResponse {

    /** Statusul operatiei: "SUCCESS" | "ERROR" */
    private String status;

    /** Numarul bonului emis de casa de marcat */
    private String receiptNumber;

    /** ID-ul fiscal al bonului (numar memorie fiscala + numar document) */
    private String fiscalReceiptId;

    /** Seria casei de marcat */
    private String cashRegisterSerial;

    /** Data/ora emiterii bonului */
    private LocalDateTime issuedAt;

    /** Totalul bonului cu TVA inclusa */
    private BigDecimal totalAmount;

    /** Metoda de plata (preluata din request) */
    private String paymentMethod;

    /** Codul erorii in caz de esec (ex: "FP_ERROR", "TIMEOUT", "COMM_ERROR") */
    private String errorCode;

    /** Mesajul de eroare detaliat */
    private String errorMessage;
}
