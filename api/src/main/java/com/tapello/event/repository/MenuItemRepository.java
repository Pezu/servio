package com.tapello.event.repository;

import com.tapello.event.entity.MenuItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItemEntity, UUID> {
    List<MenuItemEntity> findByLocationIdOrderBySortOrder(UUID locationId);
    List<MenuItemEntity> findByParentId(UUID parentId);
    List<MenuItemEntity> findByLocationIdAndParentIsNull(UUID locationId);
    void deleteByLocationId(UUID locationId);

    // Client-level menu methods
    List<MenuItemEntity> findByClientIdOrderBySortOrder(UUID clientId);
    List<MenuItemEntity> findByClientIdAndParentIsNull(UUID clientId);
    void deleteByClientId(UUID clientId);
}