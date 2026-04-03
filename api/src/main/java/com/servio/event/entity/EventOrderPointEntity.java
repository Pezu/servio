package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "event_order_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EventOrderPointEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private EventEntity event;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_point_id", nullable = false)
    private OrderPointEntity orderPoint;

    @Column(precision = 10, scale = 2)
    private BigDecimal prepaid = BigDecimal.ZERO;

    @Column(name = "client_name")
    private String clientName;

    @Column
    private String email;

    @Column
    private String phone;

    @Column
    private boolean credit = false;

    @Column(name = "credit_value", precision = 10, scale = 2)
    private BigDecimal creditValue;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod;
}
