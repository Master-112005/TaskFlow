package taskflow.dto;

import taskflow.model.User;
import jakarta.validation.constraints.*;

import java.time.Instant;

public class AuthDtos {

    public record RegisterRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 100) String password,
            @NotBlank String userType,
            @NotBlank String role) {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    /** Profile edit: name is required; password change is optional but needs the current password. */
    public record UpdateProfileRequest(
            @NotBlank String name,
            String currentPassword,
            @Size(min = 6, max = 100, message = "New password must be 6-100 characters") String newPassword,
            String avatar,
            String status) {
    }

    public record ProfileDto(Long id, String name, String email, String userType, String role,
                             boolean githubConnected, Instant createdAt, String avatar, String status) {
        public static ProfileDto from(User u) {
            return new ProfileDto(u.getId(), u.getName(), u.getEmail(),
                    u.getUserType().name(), u.getRole().name(), u.getGithubToken() != null,
                    u.getCreatedAt(), u.getAvatar(), u.getStatus());
        }
    }

    public record AuthResponse(String token, ProfileDto user) {
    }
}
