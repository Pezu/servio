package com.servio.event.repository;

import com.servio.event.entity.MenuEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MenuRepository extends JpaRepository<MenuEntity, UUID> {

    List<MenuEntity> findByLocationIdOrderByName(UUID locationId);

    List<MenuEntity> findByLocationId(UUID locationId);
}
