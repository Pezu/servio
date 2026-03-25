package com.servio.event.exception;

import java.util.UUID;

/**
 * Exception thrown when a requested resource is not found.
 */
public class ResourceNotFoundException extends RuntimeException {

    private final String resourceType;
    private final Object resourceId;

    public ResourceNotFoundException(String resourceType, UUID id) {
        super(String.format("%s not found with id: %s", resourceType, id));
        this.resourceType = resourceType;
        this.resourceId = id;
    }

    public ResourceNotFoundException(String resourceType, String identifier) {
        super(String.format("%s not found: %s", resourceType, identifier));
        this.resourceType = resourceType;
        this.resourceId = identifier;
    }

    public String getResourceType() {
        return resourceType;
    }

    public Object getResourceId() {
        return resourceId;
    }
}