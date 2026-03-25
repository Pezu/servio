package com.servio.event.repository;

import com.servio.event.entity.AllergenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AllergenRepository extends JpaRepository<AllergenEntity, UUID> {

    Optional<AllergenEntity> findByNumber(Integer number);

    boolean existsByNumber(Integer number);

    @Query("SELECT COALESCE(MAX(a.number), 0) FROM AllergenEntity a")
    Integer findMaxNumber();

    List<AllergenEntity> findByActiveTrueOrderByNumberAsc();
}
