package com.datecs.printerfpgate.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO primit din cloud socket – reprezinta un bon fiscal de tiparit.
 *
 * Exemplu JSON:
 * {
 *   "requestId":     "607ab498-f4fe-477b-8bf0-8803206a3af1",
 *   "eventId":       "99f73ac5-6c69-4c5f-899d-1d7b847df78f",
 *   "paymentMethod": "CARD",
 *   "cashRegister":  "192.168.100.245",
 *   "lines": [
 *     { "name": "Cola Bar",  "quantity": 2, "unitPrice": 40.00,  "vat": 21.00 },
 *     { "name": "Whiskey",   "quantity": 1, "unitPrice": 130.00, "vat": 21.00 },
 *     { "name": "Servicii servire speciala", "quantity": 1, "unitPrice": 12.00, "vat": 5.00 }
 *   ]
 * }
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PrintReceiptRequest {

    /** ID unic al request-ului */
    private String requestId;

    /** ID eveniment din sistemul extern */
    private String eventId;

    /**
     * Metoda de plata: CASH | CARD | CHECK
     * Mapare la DATECS cmd 53 payMode:
     *   CASH  → 0
     *   CARD  → 1
     *   CHECK → 2
     */
    private String paymentMethod;

    /**
     * Adresa IP a casei de marcat (ex: "192.168.100.245").
     * Se foloseste pentru conectarea TCP pe portul configurat.
     */
    private String cashRegister;

    /** Liniile bonului */
    private List<PrintReceiptLine> lines;
}
