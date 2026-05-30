package com.datecs.printerfpgate;

import com.datecs.printerfpgate.dto.PrintReceiptLine;
import com.datecs.printerfpgate.dto.PrintReceiptRequest;
import com.datecs.printerfpgate.dto.ReceiptResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.Socket;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Orchestreaza tiparirea unui bon fiscal pe DATECS DP-25MX.
 *
 * Flux per request:
 *   1. Deschide conexiune TCP catre casa de marcat (IP din request, port din config)
 *   2. Recovery: anuleaza bon ramas deschis (cmd 60)
 *   3. Deschide bon fiscal cu UNS unic per casa (cmd 48)
 *   4. Adauga liniile (cmd 49) cu grup TVA corespunzator
 *   5. Text fiscal (cmd 54)
 *   6. Totalizeaza cu metoda de plata (cmd 53)
 *   7. Inchide bonul (cmd 56) si obtine numarul documentului
 *   8. Inchide conexiunea TCP
 *   9. Returneaza ReceiptResponse
 */
@Slf4j
@Service
public class FiscalPrinterService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.BASIC_ISO_DATE; // YYYYMMDD

    private final PrinterProperties props;

    /** Contor UNS (Unique Number of Sale) per IP casa de marcat. */
    private final ConcurrentHashMap<String, AtomicLong> unsSeqPerIp = new ConcurrentHashMap<>();

    /**
     * Hardcoded VAT% → DATECS fiscal group mapping. Must match how the printer's
     * tax groups are programmed: 1=A (21%), 2=B (11%), 3=C (0%). Any VAT% not
     * listed falls back to group A. Do NOT change without re-checking the
     * device's programmed groups.
     */
    private static final Map<Integer, Integer> VAT_TO_TAX_GROUP =
            Map.of(21, 1, 11, 2, 0, 3);

    /** Payment method → DATECS cmd 53 payMode (0=CASH, 1=CARD, 2=CHECK). */
    private static final Map<String, Integer> PAYMENT_TO_PAYMODE = Map.of(
            "CASH",  DatecsDPMXProtocol.PAY_CASH,
            "CARD",  DatecsDPMXProtocol.PAY_CARD,
            "CHECK", DatecsDPMXProtocol.PAY_CHECK,
            "CEC",   DatecsDPMXProtocol.PAY_CHECK
    );

    public FiscalPrinterService(PrinterProperties props) {
        this.props = props;
    }

    public ReceiptResponse print(PrintReceiptRequest request) {
        log.info("════════════════════════════════════════════════");
        log.info("PRINT REQUEST PRIMIT");
        log.info("  requestId    : {}", request.getRequestId());
        log.info("  eventId      : {}", request.getEventId());
        log.info("  cashRegister : {}", request.getCashRegister());
        log.info("  paymentMethod: {}", request.getPaymentMethod());
        if (request.getLines() != null) {
            request.getLines().forEach(line ->
                log.info("  linie: '{}' x{} @ {} RON, TVA {}%",
                    line.getName(), line.getQuantity(),
                    line.getUnitPrice(), line.getVat())
            );
        }
        log.info("────────────────────────────────────────────────");

        String host = request.getCashRegister() != null
                ? request.getCashRegister()
                : props.getTcp().getHost();
        int port = props.getTcp().getPort();

        try (Socket socket = new Socket(host, port)) {
            log.info("Conectat TCP la {}:{}", host, port);
            DatecsDPMXProtocol fp = new DatecsDPMXProtocol(socket);
            return doPrint(fp, request, host);
        } catch (Exception ex) {
            log.error("Eroare tiparire bon requestId={}: {}", request.getRequestId(), ex.getMessage(), ex);
            DatecsErrorMapper.MappedError err = DatecsErrorMapper.map(ex, host);
            log.error("  → errorCode=[{}] errorMessage=[{}]", err.code, err.message);
            return ReceiptResponse.builder()
                    .status("ERROR")
                    .paymentMethod(request.getPaymentMethod())
                    .issuedAt(LocalDateTime.now())
                    .errorCode(err.code)
                    .errorMessage(err.message)
                    .build();
        }
    }

    private ReceiptResponse doPrint(DatecsDPMXProtocol fp, PrintReceiptRequest request, String host) throws Exception {
        String opCode  = props.getOperator().getCode();
        String opPass  = props.getOperator().getPass();
        String tillNum = props.getTillNumber();

        // 1. Recovery — anuleaza bon deschis (cmd 60)
        log.info("CMD 60 – Recovery: anulez bon deschis anterior (daca exista)");
        fp.cancelFiscalCheck();

        // 2. UNS unic per casa
        String uns = generateUns(host);
        log.info("CMD 48 – Deschid bon fiscal (op={}, till={}, uns={})", opCode, tillNum, uns);
        long allReceipt = fp.openFiscalCheck(opCode, opPass, tillNum, uns);

        // 3. Sincronizeaza contorul UNS cu valoarea reala
        syncUnsCounter(host, allReceipt);

        // 4. Linii (cmd 49)
        if (request.getLines() != null) {
            for (PrintReceiptLine line : request.getLines()) {
                int taxGroup = resolveVatGroup(line.getVat());
                double price = line.getUnitPrice().doubleValue();
                double qty   = line.getQuantity();
                log.info("CMD 49 – Articol: '{}' taxGroup={} pret={} qty={}",
                        line.getName(), taxGroup, price, qty);
                fp.sell(line.getName(), taxGroup, price, qty);
            }
        }

        // 5. Text fiscal (cmd 54)
        fp.printFiscalText("Multumim pentru vizita!");

        // 6. Totalizeaza cu metoda de plata (cmd 53)
        int payMode = resolvePayMode(request.getPaymentMethod());
        log.info("CMD 53 – Plata: payMode={} ({})", payMode, request.getPaymentMethod());
        fp.total(payMode);

        // 7. Inchide bonul si obtine numarul documentului (cmd 56)
        log.info("CMD 56 – Inchid bonul fiscal");
        DatecsDPMXProtocol.ReceiptInfo receiptInfo = fp.closeFiscalCheck();

        BigDecimal totalAmount = calculateTotal(request);
        ReceiptResponse response = ReceiptResponse.builder()
                .status("SUCCESS")
                .receiptNumber(receiptInfo.docNumber.isEmpty() ? null : receiptInfo.docNumber)
                .fiscalReceiptId(receiptInfo.docNumber.isEmpty() ? null : receiptInfo.docNumber)
                .cashRegisterSerial(props.getSerialNumber().isEmpty() ? host : props.getSerialNumber())
                .issuedAt(LocalDateTime.now())
                .totalAmount(totalAmount)
                .paymentMethod(request.getPaymentMethod())
                .build();

        log.info("════════════════════════════════════════════════");
        log.info("RECEIPT RESPONSE");
        log.info("  status           : {}", response.getStatus());
        log.info("  receiptNumber    : {}", response.getReceiptNumber());
        log.info("  fiscalReceiptId  : {}", response.getFiscalReceiptId());
        log.info("  cashRegisterSerial: {}", response.getCashRegisterSerial());
        log.info("  issuedAt         : {}", response.getIssuedAt());
        log.info("  totalAmount      : {} RON", response.getTotalAmount());
        log.info("  paymentMethod    : {}", response.getPaymentMethod());
        log.info("════════════════════════════════════════════════");
        return response;
    }

    private String generateUns(String ip) {
        AtomicLong counter = unsSeqPerIp.computeIfAbsent(ip, k -> new AtomicLong(0L));
        long seq = counter.incrementAndGet();
        String date = LocalDate.now().format(DATE_FMT);
        String till = formatTill(props.getTillNumber());
        return String.format("%s-%s-%07d", date, till, seq);
    }

    private void syncUnsCounter(String ip, long allReceipt) {
        if (allReceipt <= 0L) return;
        AtomicLong counter = unsSeqPerIp.computeIfAbsent(ip, k -> new AtomicLong(0L));
        long prev = counter.getAndSet(allReceipt);
        if (prev != allReceipt) {
            log.info("UNS sync [{}]: contor corectat {} → {} (AllReceipt de la imprimanta)",
                    ip, prev, allReceipt);
        }
    }

    private String formatTill(String till) {
        try {
            return String.format("%04d", Long.parseLong(till.trim()));
        } catch (NumberFormatException e) {
            return (till + "0000").substring(0, 4);
        }
    }

    private int resolveVatGroup(BigDecimal vat) {
        if (vat == null) return 1;
        int vatInt = vat.setScale(0, RoundingMode.HALF_UP).intValue();
        return VAT_TO_TAX_GROUP.getOrDefault(vatInt, 1);
    }

    private int resolvePayMode(String paymentMethod) {
        if (paymentMethod == null) return 0;
        return PAYMENT_TO_PAYMODE.getOrDefault(paymentMethod.toUpperCase(), 0);
    }

    private BigDecimal calculateTotal(PrintReceiptRequest request) {
        if (request.getLines() == null) return BigDecimal.ZERO;
        return request.getLines().stream()
                .map(line -> line.getUnitPrice()
                        .multiply(BigDecimal.valueOf(line.getQuantity()))
                        .setScale(2, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
