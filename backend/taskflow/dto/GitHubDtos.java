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
