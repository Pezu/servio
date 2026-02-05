package com.tapello.event.repository;

import com.tapello.event.entity.UserEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByUsername(String username);
    List<UserEntity> findByClientId(UUID clientId);
    Page<UserEntity> findByClientId(UUID clientId, Pageable pageable);
    boolean existsByUsername(String username);
}