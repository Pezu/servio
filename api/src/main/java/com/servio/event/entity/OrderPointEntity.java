package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "order_points")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderPointEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean payLater = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private LocationEntity location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    private MenuItemEntity menuItem;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "order_point_menus",
            joinColumns = @JoinColumn(name = "order_point_id"),
            inverseJoinColumns = @JoinColumn(name = "menu_id")
    )
    private Set<MenuEntity> menus = new HashSet<>();
}