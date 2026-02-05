package com.tapello.event.web;

import com.tapello.event.service.ImageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {

    private final ImageService imageService;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }

            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only image files are allowed"));
            }

            String objectName = imageService.uploadImage(file);
            String url = "/api/images/" + objectName;

            return ResponseEntity.ok(Map.of(
                    "id", objectName,
                    "url", url
            ));
        } catch (Exception e) {
            log.error("Failed to upload image", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{objectName}")
    public ResponseEntity<InputStreamResource> getImage(@PathVariable String objectName) {
        try {
            InputStream inputStream = imageService.getImage(objectName);
            String contentType = imageService.getContentType(objectName);

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=31536000")
                    .body(new InputStreamResource(inputStream));
        } catch (Exception e) {
            log.error("Failed to get image: {}", objectName, e);
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{objectName}")
    public ResponseEntity<Void> deleteImage(@PathVariable String objectName) {
        try {
            imageService.deleteImage(objectName);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Failed to delete image: {}", objectName, e);
            return ResponseEntity.notFound().build();
        }
    }
}