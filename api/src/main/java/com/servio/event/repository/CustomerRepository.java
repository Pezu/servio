package com.servio.event.repository;

import com.servio.event.entity.CustomerEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<CustomerEntity, UUID> {
    Optional<CustomerEntity> findByPrefixAndPhone(String prefix, String phone);
}
