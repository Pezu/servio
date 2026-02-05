package com.tapello.event.service;

import com.tapello.event.dto.CreateUserRequest;
import com.tapello.event.dto.UpdateUserRequest;
import com.tapello.event.dto.User;
import com.tapello.event.entity.ClientEntity;
import com.tapello.event.entity.UserEntity;
import com.tapello.event.mapper.UserMapper;
import com.tapello.event.repository.ClientRepository;
import com.tapello.event.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("User with username '" + request.getUsername() + "' already exists");
        }

        ClientEntity client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new RuntimeException("Client not found with id: " + request.getClientId()));

        UserEntity userEntity = new UserEntity();
        userEntity.setUsername(request.getUsername());
        userEntity.setPassword(passwordEncoder.encode(request.getPassword()));
        userEntity.setName(request.getName());
        userEntity.setRoles(request.getRoles());
        userEntity.setClient(client);

        UserEntity savedEntity = userRepository.save(userEntity);
        return userMapper.toDto(savedEntity);
    }

    public User getUserById(UUID id) {
        UserEntity userEntity = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
        return userMapper.toDto(userEntity);
    }

    public Page<User> getUsersByClientId(UUID clientId, Pageable pageable) {
        return userRepository.findByClientId(clientId, pageable).map(userMapper::toDto);
    }

    @Transactional
    public User updateUser(UUID id, UpdateUserRequest request) {
        UserEntity userEntity = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        // Check if username is being changed and if new username already exists
        if (!userEntity.getUsername().equals(request.getUsername()) &&
            userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("User with username '" + request.getUsername() + "' already exists");
        }

        userEntity.setUsername(request.getUsername());
        userEntity.setName(request.getName());
        userEntity.setRoles(request.getRoles());

        // Only update password if provided
        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            userEntity.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        UserEntity savedEntity = userRepository.save(userEntity);
        return userMapper.toDto(savedEntity);
    }

    @Transactional
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found with id: " + id);
        }
        userRepository.deleteById(id);
    }
}