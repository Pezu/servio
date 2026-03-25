package com.servio.event.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "allergens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AllergenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private Integer number;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean active = true;
}
