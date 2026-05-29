package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "event_order_point_users",
            joinColumns = @JoinColumn(name = "event_order_point_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<UserEntity> users = new HashSet<>();

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

    /** Marks the order point as a protocol-paid table. Backoffice toggle. */
    @Column(nullable = false)
    private boolean protocol = false;
}