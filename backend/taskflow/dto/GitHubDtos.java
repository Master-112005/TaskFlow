package taskflow.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

public class GitHubDtos {

    /** An account linked to the current user (profile page / repo picker). */
    public record LinkedAccountDto(long id, String provider, String username, String connectedAt, boolean active) {
        public static LinkedAccountDto from(taskflow.model.LinkedGithubAccount a, String activeToken) {
            return new LinkedAccountDto(
                    a.getId(),
                    a.getProvider(),
                    a.getUsername(),
                    a.getConnectedAt() == null ? null : a.getConnectedAt().toString(),
                    activeToken != null && activeToken.equals(a.getToken()));
        }
    }

    public record RepoDto(String fullName, String name, String owner, String description,
                          boolean isPrivate, String updatedAt, String htmlUrl) {
        public static RepoDto from(JsonNode n) {
            return new RepoDto(
                    n.path("full_name").asText(),
                    n.path("name").asText(),
                    n.path("owner").path("login").asText(),
                    n.path("description").asText(null),
                    n.path("private").asBoolean(false),
                    n.path("updated_at").asText(null),
                    n.path("html_url").asText(null));
        }
    }

    /** Request body for creating a new issue. */
    public record CreateIssueRequest(@jakarta.validation.constraints.NotBlank String title, String body) {
    }

    /** Request body for opening a pull request. */
    public record CreatePullRequest(
            @jakarta.validation.constraints.NotBlank String title,
            @jakarta.validation.constraints.NotBlank String head,
            @jakarta.validation.constraints.NotBlank String base,
            String body,
            /** Boolean (not primitive) so an omitted "draft" can't fail JSON deserialization. */
            Boolean draft) {
    }

    /** A branch of the project's repo (base/head pickers in the pull-request form). */
    public record BranchDto(String name) {
    }

    /** A GitHub Actions workflow defined in the repo. */
    public record WorkflowDto(long id, String name, String path, String state, String htmlUrl) {
        public static WorkflowDto from(JsonNode n) {
            return new WorkflowDto(
                    n.path("id").asLong(),
                    n.path("name").asText(),
                    n.path("path").asText(null),
                    n.path("state").asText(null),
                    n.path("html_url").asText(null));
        }
    }

    /** One execution of a GitHub Actions workflow. */
    public record WorkflowRunDto(long id, String name, long workflowId, String status,
                                 String conclusion, String branch, String event, String actor,
                                 int runNumber, String createdAt, String updatedAt, String htmlUrl) {
        public static WorkflowRunDto from(JsonNode n) {
            String conclusion = n.path("conclusion").isNull() ? null : n.path("conclusion").asText(null);
            return new WorkflowRunDto(
                    n.path("id").asLong(),
                    n.path("name").asText(),
                    n.path("workflow_id").asLong(),
                    n.path("status").asText(null),
                    conclusion,
                    n.path("head_branch").asText(null),
                    n.path("event").asText(null),
                    n.path("actor").path("login").asText(null),
                    n.path("run_number").asInt(0),
                    n.path("created_at").asText(null),
                    n.path("updated_at").asText(null),
                    n.path("html_url").asText(null));
        }
    }

    /** Request body for manually running a workflow on a branch. */
    public record DispatchWorkflowRequest(@jakarta.validation.constraints.NotBlank String ref) {
    }

    /** One comment on an issue or pull request. */
    public record CommentDto(long id, String author, String body, String createdAt, String htmlUrl) {
        public static CommentDto from(JsonNode n) {
            return new CommentDto(
                    n.path("id").asLong(),
                    n.path("user").path("login").asText(null),
                    n.path("body").asText(""),
                    n.path("created_at").asText(null),
                    n.path("html_url").asText(null));
        }
    }

    /** A pull-request review: APPROVED / CHANGES_REQUESTED / COMMENTED / DISMISSED. */
    public record ReviewDto(long id, String author, String state, String body, String submittedAt) {
        public static ReviewDto from(JsonNode n) {
            return new ReviewDto(
                    n.path("id").asLong(),
                    n.path("user").path("login").asText(null),
                    n.path("state").asText(null),
                    n.path("body").asText(""),
                    n.path("submitted_at").asText(null));
        }
    }

    /** A label available in the repository. */
    public record RepoLabelDto(String name, String color, String description) {
        public static RepoLabelDto from(JsonNode n) {
            return new RepoLabelDto(
                    n.path("name").asText(),
                    n.path("color").asText(null),
                    n.path("description").asText(null));
        }
    }

    /** Partial issue edit: a null field is left unchanged. */
    public record UpdateIssueRequest(String state, String title, String body, List<String> labels) {
    }

    /** Partial pull-request edit: a null field is left unchanged. */
    public record UpdatePullRequest(String state, String title, String body) {
    }

    public record CreateCommentRequest(@jakarta.validation.constraints.NotBlank String body) {
    }

    /** event: APPROVE, REQUEST_CHANGES or COMMENT. */
    public record CreateReviewRequest(@jakarta.validation.constraints.NotBlank String event, String body) {
    }

    /** mergeMethod: merge (default), squash or rebase. */
    public record MergePullRequest(String mergeMethod) {
    }

    public record IssueDto(long number, String title, String state, String author,
                           String createdAt, String updatedAt, String htmlUrl, String body,
                           int comments, List<String> labels) {
        public static IssueDto from(JsonNode n) {
            List<String> labels = new ArrayList<>();
            n.path("labels").forEach(l -> labels.add(l.path("name").asText()));
            return new IssueDto(
                    n.path("number").asLong(),
                    n.path("title").asText(),
                    n.path("state").asText(),
                    n.path("user").path("login").asText(null),
                    n.path("created_at").asText(null),
                    n.path("updated_at").asText(null),
                    n.path("html_url").asText(null),
                    n.path("body").asText(null),
                    n.path("comments").asInt(0),
                    labels);
        }
    }

    public record PullDto(long number, String title, String state, String author,
                          String createdAt, String htmlUrl, String body,
                          String headBranch, String baseBranch, boolean isDraft) {
        public static PullDto from(JsonNode n) {
            return new PullDto(
                    n.path("number").asLong(),
                    n.path("title").asText(),
                    n.path("state").asText(),
                    n.path("user").path("login").asText(null),
                    n.path("created_at").asText(null),
                    n.path("html_url").asText(null),
                    n.path("body").asText(null),
                    n.path("head").path("ref").asText(null),
                    n.path("base").path("ref").asText(null),
                    n.path("draft").asBoolean(false));
        }
    }
}
