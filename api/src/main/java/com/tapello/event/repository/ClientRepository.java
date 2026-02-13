package com.tapello.event.repository;

import com.tapello.event.entity.ClientEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClientRepository extends JpaRepository<ClientEntity, UUID> {
    UUID SYSTEM_CLIENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    Optional<ClientEntity> findByEmail(String email);

    @Query("SELECT c FROM ClientEntity c WHERE " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<ClientEntity> searchByNameOrEmailOrPhone(@Param("search") String search, Pageable pageable);

    @Query("SELECT c FROM ClientEntity c WHERE c.id <> :systemClientId")
    Page<ClientEntity> findAllExcludingSystem(@Param("systemClientId") UUID systemClientId, Pageable pageable);

    @Query("SELECT c FROM ClientEntity c WHERE c.id <> :systemClientId AND (" +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<ClientEntity> searchByNameOrEmailOrPhoneExcludingSystem(
            @Param("search") String search,
            @Param("systemClientId") UUID systemClientId,
            Pageable pageable);
}