package com.datecs.printerfpgate.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * O linie de produs/serviciu din bonul fiscal.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PrintReceiptLine {

    /** Denumirea produsului sau serviciului */
    private String name;

    /** Cantitatea vanduta */
    private double quantity;

    /** Pretul unitar (fara TVA) */
    private BigDecimal unitPrice;

    /**
     * Cota TVA in procente (ex: 21.00, 11.00, 0.00).
     * Mapare la grup fiscal DATECS:
     *   21% → taxGroup 1 (A)
     *   11% → taxGroup 2 (B)
     *   0%  → taxGroup 3 (C)
     */
    private BigDecimal vat;
}
