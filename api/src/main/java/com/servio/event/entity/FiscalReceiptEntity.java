package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One fiscal-receipt dispatch to the cash register, tracked independently of the
 * order(s) it settles. Keyed by {@code requestId} — the value echoed by the
 * bridge agent — so the async reply correlates back to exactly this receipt.
 *
 * <p>A partial payment produces one receipt per installment, each with its own
 * item scope; tracking per dispatch (instead of per order) keeps their statuses
 * separate and lets a retry reprint exactly the failed receipt's items.
 */
@Entity
@Table(name = "fiscal_receipts")
@Getter
@Setter
@NoArgsConstructor
public class FiscalReceiptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Correlation key dispatched to the bridge and echoed back in the reply. */
    @Column(name = "request_id", nullable = false, unique = true, length = 64)
    private String requestId;

    @Column(name = "event_id")
    private UUID eventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private FiscalReceiptStatus status;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    /** ECR device this receipt was dispatched to — reused on retry. */
    @Column(name = "cash_register_device_id", length = 64)
    private String cashRegisterDeviceId;

    @Column(name = "fiscal_receipt_id", length = 64)
    private String fiscalReceiptId;

    @Column(name = "error", length = 500)
    private String error;

    @Column(name = "total_amount", precision = 19, scale = 2)
    private BigDecimal totalAmount;

    /** A retry supersedes the old receipt so it drops out of the FAILED list. */
    @Column(name = "superseded", nullable = false)
    private boolean superseded = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "attempted_at")
    private LocalDateTime attemptedAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "fiscal_receipt_orders",
            joinColumns = @JoinColumn(name = "fiscal_receipt_id"))
    @Column(name = "order_id")
    private List<UUID> orderIds = new ArrayList<>();

    /** Item rows this receipt was scoped to (partial pay). Empty = full scope. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "fiscal_receipt_items",
            joinColumns = @JoinColumn(name = "fiscal_receipt_id"))
    @Column(name = "order_item_id")
    private List<UUID> orderItemIds = new ArrayList<>();
}
