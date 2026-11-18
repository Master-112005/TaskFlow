package taskflow.dto;

import taskflow.model.Project;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

public class ProjectDtos {

    /** Repo owner/name are optional: a project can be created without GitHub
     *  and the team lead attaches a repository later. */
    public record CreateProjectRequest(String repoOwner, String repoName, String name, Long accountId) {
        public boolean hasRepo() {
            return repoOwner != null && !repoOwner.isBlank() && repoName != null && !repoName.isBlank();
        }
    }

    /** A repository attached to a project later (lead flow) — or the create request without one. */
    public record AttachRepoRequest(
            @NotBlank String repoOwner,
            @NotBlank String repoName,
            Long accountId) {
    }

    public record JoinRequest(@NotBlank String code) {
    }

    /** Result of entering an invite code: joined straight away, or waiting for admin approval. */
    public record JoinResponse(String status, ProjectDto project) {
        public static JoinResponse joined(ProjectDto project) {
            return new JoinResponse("JOINED", project);
        }

        public static JoinResponse pending() {
            return new JoinResponse("PENDING", null);
        }
    }

    /** A pending "let me in" request shown on the admin home page. */
    public record JoinRequestDto(long id, long projectId, String projectName,
                                 Long userId, String userName, String userEmail, String role, String avatar,
                                 String requestedAt) {
        public static JoinRequestDto from(taskflow.model.JoinRequest r) {
            return new JoinRequestDto(
                    r.getId(),
                    r.getProject().getId(),
                    r.getProject().getName(),
                    r.getUser().getId(),
                    r.getUser().getName(),
                    r.getUser().getEmail(),
                    r.getUser().getRole().name(),
                    r.getUser().getAvatar(),
                    DateTimeFormatter.ISO_INSTANT.format(r.getRequestedAt().atOffset(ZoneOffset.UTC)));
        }
    }

    /** A team lead card for the manager's team panel. */
    public record TeamLeadDto(Long id, String name, String email, String role, String avatar,
                              int projectCount, int memberCount) {
    }

    public record SendMessageRequest(@NotBlank String content, Long recipientId) {
    }

    public record ProjectDto(Long id, String name, String repoOwner, String repoName,
                             String inviteCode, Long createdById, String createdByName,
                             int memberCount, String createdAt) {
        public static ProjectDto from(Project p, int memberCount) {
            return new ProjectDto(
                    p.getId(),
                    p.getName(),
                    p.getRepoOwner(),
                    p.getRepoName(),
                    p.getInviteCode(),
                    p.getCreatedBy().getId(),
                    p.getCreatedBy().getName(),
                    memberCount,
                    format(p.getCreatedAt()));
        }

        private static String format(Instant instant) {
            return DateTimeFormatter.ISO_INSTANT.format(instant.atOffset(ZoneOffset.UTC));
        }
    }

    public record MemberDto(Long id, String name, String email, String role, String avatar, String status) {
        public static MemberDto from(taskflow.model.User u) {
            return new MemberDto(u.getId(), u.getName(), u.getEmail(), u.getRole().name(), u.getAvatar(), u.getStatus());
        }
    }

    public record MessageDto(long id, long senderId, String senderName, String senderRole, String senderAvatar,
                             String senderStatus, String content, String createdAt) {
        public static MessageDto from(taskflow.model.Message m) {
            return new MessageDto(
                    m.getId(),
                    m.getSender().getId(),
                    m.getSender().getName(),
                    m.getSender().getRole().name(),
                    m.getSender().getAvatar(),
                    m.getSender().getStatus(),
                    m.getContent(),
                    DateTimeFormatter.ISO_INSTANT.format(m.getCreatedAt().atOffset(ZoneOffset.UTC)));
        }
    }
}
