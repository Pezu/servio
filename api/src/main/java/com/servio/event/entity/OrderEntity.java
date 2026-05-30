package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "registration_id", nullable = false)
    private UUID registrationId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "order_point_id", nullable = false)
    private UUID orderPointId;

    /**
     * Where the order is *served from*. For non-pay-later OPs (bars/quick
     * serve) this is the same as {@link #orderPointId}; for pay-later OPs
     * (tables) it's the linked bar configured in Edit Event → Order
     * Points → Bar dropdown. May be null when the table has no bar yet.
     */
    @Column(name = "service_order_point_id")
    private UUID serviceOrderPointId;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "order_no", nullable = false)
    private Integer orderNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrderStatus status;

    @Column(name = "assigned_user", length = 50)
    private String assignedUser;

    @Column(name = "note")
    private String note;

    @Column(name = "needs_payment", nullable = false)
    private boolean needsPayment = false;

    @Column(name = "nickname", length = 100)
    private String nickname;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    @Column(name = "paid_by", length = 100)
    private String paidBy;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "tip", precision = 19, scale = 2)
    private BigDecimal tip;

    /** Distinct payment transactions that have settled this order. > 1 means
     *  it was paid in multiple installments (partial pay from the app). */
    @Column(name = "payment_count", nullable = false)
    private int paymentCount = 0;

    /**
     * Fiscal-receipt lifecycle, independent of payment. NULL = no receipt was
     * attempted (PROTOCOL payments, or no ECR device). See {@link FiscalReceiptStatus}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "fiscal_receipt_status", length = 20)
    private FiscalReceiptStatus fiscalReceiptStatus;

    /** Fiscal-memory id of the issued receipt (set when status = ISSUED). */
    @Column(name = "fiscal_receipt_id", length = 64)
    private String fiscalReceiptId;

    /** requestId of the last receipt dispatched to the bridge — correlates the
     *  async agent reply back to this order. */
    @Column(name = "fiscal_request_id", length = 64)
    private String fiscalRequestId;

    /** Human-readable reason of the last fiscal failure (set when status = FAILED). */
    @Column(name = "fiscal_error", length = 500)
    private String fiscalError;

    /** When the last fiscal receipt was dispatched/attempted. */
    @Column(name = "fiscal_attempted_at")
    private LocalDateTime fiscalAttemptedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItemEntity> items = new ArrayList<>();

    /** Payment transactions that settled this order (one per installment). */
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderPaymentEntity> payments = new ArrayList<>();

    public void addItem(OrderItemEntity item) {
        items.add(item);
        item.setOrder(this);
    }
}