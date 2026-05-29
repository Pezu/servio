package com.servio.event.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One payment transaction that settled (part of) an order. A full pay creates a
 * single row; partial pay from the app creates one row per installment — so the
 * revenue report can show how much was paid in each payment and by which method.
 */
@Entity
@Table(name = "order_payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderPaymentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonIgnore
    private OrderEntity order;

    /** Item value settled in this transaction (sum of price × quantity). */
    @Column(name = "amount", precision = 19, scale = 2, nullable = false)
    private BigDecimal amount;

    /** "CASH", "CARD", "ONLINE", or "PROTOCOL". */
    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    @Column(name = "paid_by", length = 100)
    private String paidBy;

    @Column(name = "paid_at", nullable = false)
    private LocalDateTime paidAt;
}