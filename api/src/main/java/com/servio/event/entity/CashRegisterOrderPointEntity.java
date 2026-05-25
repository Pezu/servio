package com.servio.event.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Per-event mapping from a cash register to one of the event's order points.
 * The unique constraint on (event_id, order_point_id) in the DB enforces that
 * within a single event an order point is served by at most one cash register.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "cash_register_order_points", schema = "event")
public class CashRegisterOrderPointEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "cash_register_id", nullable = false)
    private UUID cashRegisterId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "order_point_id", nullable = false)
    private UUID orderPointId;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
