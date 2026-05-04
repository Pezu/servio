package com.servio.event.repository;

import com.servio.event.entity.OrderGroupEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OrderGroupRepository extends JpaRepository<OrderGroupEntity, UUID> {
}
