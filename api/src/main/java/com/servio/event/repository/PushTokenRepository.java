package com.servio.event.repository;

import com.servio.event.entity.PushTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PushTokenRepository extends JpaRepository<PushTokenEntity, String> {
    List<PushTokenEntity> findByUserIdIn(List<UUID> userIds);
    void deleteByToken(String token);
}
