package taskflow.controller;

import taskflow.dto.AuthDtos.AuthResponse;
import taskflow.dto.AuthDtos.LoginRequest;
import taskflow.dto.AuthDtos.ProfileDto;
import taskflow.dto.AuthDtos.RegisterRequest;
import taskflow.dto.AuthDtos.UpdateProfileRequest;
import taskflow.model.Role;
import taskflow.model.User;
import taskflow.model.UserType;
import taskflow.repository.UserRepository;
import taskflow.security.JwtService;
import taskflow.service.AccessService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** Roles a NORMAL user (developer/tester/dev team) can pick. */
    private static final Set<Role> NORMAL_ROLES = Set.of(
            Role.FRONTEND_DEVELOPER, Role.BACKEND_DEVELOPER, Role.TESTER, Role.DEV_TEAM);

    /** Roles an ADMIN user (team lead / admin / manager) can pick. */
    private static final Set<Role> ADMIN_ROLES = Set.of(
            Role.TEAM_LEAD, Role.ADMIN, Role.MANAGER);

    /** Keys of the pre-built avatars the frontend offers (3 boys, 3 girls). */
    private static final Set<String> AVATAR_KEYS = Set.of(
            "BOY_1", "BOY_2", "BOY_3", "GIRL_1", "GIRL_2", "GIRL_3");

    /** Availability statuses the frontend offers under the avatar picker. */
    private static final Set<String> STATUS_KEYS = Set.of(
            "BUSY", "AVAILABLE", "LEAVE", "VACATION");

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AccessService access;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder,
                          JwtService jwtService, AccessService access) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.access = access;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        UserType userType = parseEnum(UserType.class, request.userType(), "Invalid user type");
        Role role = parseEnum(Role.class, request.role(), "Invalid role");

        Set<Role> allowed = userType == UserType.NORMAL ? NORMAL_ROLES : ADMIN_ROLES;
        if (!allowed.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Role '" + role + "' is not allowed for a " + userType + " user");
        }
        if (users.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already registered");
        }

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(request.email().trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setUserType(userType);
        user.setRole(role);
        users.save(user);

        return new AuthResponse(jwtService.generateToken(user.getEmail()), ProfileDto.from(user));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        User user = users.findByEmail(request.email().trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return new AuthResponse(jwtService.generateToken(user.getEmail()), ProfileDto.from(user));
    }

    @GetMapping("/me")
    public ProfileDto me(Authentication auth) {
        return ProfileDto.from(access.requireUser(auth));
    }

    /** Edit the signed-in user's profile: name (and optionally the password). */
    @PutMapping("/profile")
    public ProfileDto updateProfile(@Valid @RequestBody UpdateProfileRequest request, Authentication auth) {
        User user = access.requireUser(auth);
        user.setName(request.name().trim());
        if (request.newPassword() != null && !request.newPassword().isBlank()) {
            if (request.currentPassword() == null
                    || !passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
            }
            user.setPassword(passwordEncoder.encode(request.newPassword()));
        }
        if (request.avatar() != null) {
            String avatar = request.avatar().trim();
            if (avatar.isEmpty()) {
                user.setAvatar(null); // cleared -> fall back to initials
            } else if (!AVATAR_KEYS.contains(avatar)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown avatar: " + avatar);
            } else {
                user.setAvatar(avatar);
            }
        }
        if (request.status() != null) {
            String status = request.status().trim();
            if (status.isEmpty()) {
                user.setStatus(null); // cleared -> no status shown
            } else if (!STATUS_KEYS.contains(status.toUpperCase())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + status);
            } else {
                user.setStatus(status.toUpperCase());
            }
        }
        users.save(user);
        return ProfileDto.from(user);
    }

    private <T extends Enum<T>> T parseEnum(Class<T> type, String raw, String message) {
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message + ": " + raw);
        }
    }

    /** Exposed for the frontend so register dropdowns stay in sync with the backend. */
    @GetMapping("/roles")
    public Map<String, Object> roles() {
        return Map.of(
                "NORMAL", NORMAL_ROLES,
                "ADMIN", ADMIN_ROLES);
    }
}
