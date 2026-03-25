package com.servio.event.service;

import com.servio.event.dto.CreateUserRequest;
import com.servio.event.dto.UpdateUserRequest;
import com.servio.event.dto.User;
import com.servio.event.entity.ClientEntity;
import com.servio.event.entity.UserEntity;
import com.servio.event.exception.ResourceNotFoundException;
import com.servio.event.exception.ValidationException;
import com.servio.event.mapper.UserMapper;
import com.servio.event.repository.ClientRepository;
import com.servio.event.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
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
            throw new ValidationException("username", "User with username '" + request.getUsername() + "' already exists");
        }

        ClientEntity client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client", request.getClientId()));

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
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return userMapper.toDto(userEntity);
    }

    public Page<User> getUsersByClientId(UUID clientId, Pageable pageable) {
        return userRepository.findByClientId(clientId, pageable).map(userMapper::toDto);
    }

    @Transactional
    public User updateUser(UUID id, UpdateUserRequest request) {
        UserEntity userEntity = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (!userEntity.getUsername().equals(request.getUsername()) &&
            userRepository.existsByUsername(request.getUsername())) {
            throw new ValidationException("username", "User with username '" + request.getUsername() + "' already exists");
        }

        userEntity.setUsername(request.getUsername());
        userEntity.setName(request.getName());
        userEntity.setRoles(request.getRoles());

        // Functional approach: update password only if provided
        Optional.ofNullable(request.getPassword())
                .filter(password -> !password.isEmpty())
                .map(passwordEncoder::encode)
                .ifPresent(userEntity::setPassword);

        UserEntity savedEntity = userRepository.save(userEntity);
        return userMapper.toDto(savedEntity);
    }

    @Transactional
    public void deleteUser(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", id);
        }
        userRepository.deleteById(id);
    }
}