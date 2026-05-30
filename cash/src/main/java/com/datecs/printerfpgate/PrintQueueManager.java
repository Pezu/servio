package com.datecs.printerfpgate;

import com.datecs.printerfpgate.dto.PrintReceiptRequest;
import com.datecs.printerfpgate.dto.ReceiptResponse;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.*;

/**
 * Coada globala de print — serializeaza toate request-urile de tiparire
 * indiferent de casa de marcat.
 *
 * Motiv: imprimantele fiscale nu suporta conexiuni simultane si nu are sens
 * sa le floodam. Un singur thread proceseaza bonurile pe rand.
 */
@Slf4j
@Service
public class PrintQueueManager {

    private final FiscalPrinterService fiscalPrinterService;

    /**
     * Un singur thread proceseaza bonurile pe rand.
     * Bonurile in asteptare sunt pastrate in coada interna a executor-ului (unbounded).
     */
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "print-queue");
        t.setDaemon(false);
        return t;
    });

    public PrintQueueManager(FiscalPrinterService fiscalPrinterService) {
        this.fiscalPrinterService = fiscalPrinterService;
    }

    /**
     * Trimite bonul in coada si returneaza un CompletableFuture.
     * Folosit de CloudSocketService (procesare asincrona).
     */
    public CompletableFuture<ReceiptResponse> submit(PrintReceiptRequest request) {
        log.info("Bon adaugat in coada: requestId={} cashRegister={}",
                request.getRequestId(), request.getCashRegister());
        return CompletableFuture.supplyAsync(
                () -> fiscalPrinterService.print(request),
                executor
        );
    }

    @PreDestroy
    public void shutdown() {
        log.info("PrintQueueManager: oprire executor print...");
        executor.shutdown();
        try {
            if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
        log.info("PrintQueueManager: executor oprit.");
    }
}
