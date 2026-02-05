package com.tapello.event.repository;

import com.tapello.event.entity.LocationEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<LocationEntity, UUID> {
    Page<LocationEntity> findByClientId(UUID clientId, Pageable pageable);

    Page<LocationEntity> findByClientIdAndParentIsNull(UUID clientId, Pageable pageable);

    Page<LocationEntity> findByParentId(UUID parentId, Pageable pageable);

    List<LocationEntity> findByClientIdAndParentIsNull(UUID clientId);
}