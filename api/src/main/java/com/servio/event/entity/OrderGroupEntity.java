package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Groups orders that were placed together at the same order point. Set at order
 * creation time only; the group becomes frozen once any order leaves ACTIVE.
 */
@Entity
@Table(name = "order_groups")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderGroupEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_point_id", nullable = false)
    private UUID orderPointId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
