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

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItemEntity> items = new ArrayList<>();

    public void addItem(OrderItemEntity item) {
        items.add(item);
        item.setOrder(this);
    }
}