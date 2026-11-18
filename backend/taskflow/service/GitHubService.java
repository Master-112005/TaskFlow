package taskflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import taskflow.dto.GitHubDtos.BranchDto;
import taskflow.dto.GitHubDtos.IssueDto;
import taskflow.dto.GitHubDtos.PullDto;
import taskflow.dto.GitHubDtos.RepoDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Talks to the GitHub REST API using the Personal Access Token supplied
 * by admins/leads when they pick a repository.
 */
@Service
public class GitHubService {

    private static final String API = "https://api.github.com";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode getJson(String path, String token) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(API + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "TaskFlow")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .GET();
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token.trim());
        }

        try {
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            // GitHub rejecting a token is NOT a TaskFlow session problem. It must
            // never become HTTP 401 here: the frontend treats every 401 as
            // "signed out" and would force a logout. 400 keeps the user in the
            // app with a readable error.
            if (status == 401) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This GitHub account's connection has expired or was revoked — connect it again from your profile");
            }
            if (status == 403) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "GitHub refused the request (rate limit or missing scope).");
            }
            if (status == 404) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "GitHub resource not found (check the repository name or token scopes).");
            }
            if (status >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub API returned status " + status);
            }
            return mapper.readTree(response.body());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Request to GitHub was interrupted");
        }
    }

    /** Repositories owned by / accessible to the token's user. */
    public List<RepoDto> listMyRepos(String token) {
        JsonNode root = getJson("/user/repos?sort=updated&direction=desc&per_page=100", token);
        List<RepoDto> repos = new ArrayList<>();
        root.forEach(n -> repos.add(RepoDto.from(n)));
        return repos;
    }

    /** Fetch a single repo — also acts as a token + repo validation step. */
    public RepoDto getRepo(String owner, String repo, String token) {
        return RepoDto.from(getJson("/repos/" + owner + "/" + repo, token));
    }

    /** All issues of the repo (open + closed). PRs are excluded (GitHub includes them here). */
    public List<IssueDto> listIssues(String owner, String repo, String token) {
        JsonNode root = getJson("/repos/" + owner + "/" + repo + "/issues?state=all&per_page=100&sort=created&direction=desc", token);
        List<IssueDto> issues = new ArrayList<>();
        root.forEach(n -> {
            if (!n.has("pull_request")) {
                issues.add(IssueDto.from(n));
            }
        });
        return issues;
    }

    /** All pull requests of the repo (open + closed + merged). */
    public List<PullDto> listPulls(String owner, String repo, String token) {
        JsonNode root = getJson("/repos/" + owner + "/" + repo + "/pulls?state=all&per_page=100", token);
        List<PullDto> pulls = new ArrayList<>();
        root.forEach(n -> pulls.add(PullDto.from(n)));
        return pulls;
    }

    /**
     * POST/PUT/PATCH to the GitHub API. GitHub's own validation errors (422) are surfaced
     * with their message so the user sees why e.g. a pull request was rejected
     * ("No commits between base and head"), never as HTTP 401.
     */
    private JsonNode requestJson(String method, String path, String token, String json) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(API + path))
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "TaskFlow")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("Content-Type", "application/json")
                .method(method, json == null
                        ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(json));
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token.trim());
        }

        try {
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            // Same rule as getJson(): a rejected token must never become HTTP 401,
            // or the frontend would force a logout.
            if (status == 401) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "This GitHub account's connection has expired or was revoked — connect it again from your profile");
            }
            if (status == 403) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "GitHub refused the request (missing scope — the token needs 'repo' permission, or rate limit).");
            }
            if (status == 422) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, githubMessage(response.body(), "GitHub rejected the request"));
            }
            if (status >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub API returned status " + status);
            }
            if (response.body() == null || response.body().isBlank()) {
                // 204 No Content (e.g. accepted invitation, already a collaborator)
                return null;
            }
            return mapper.readTree(response.body());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Request to GitHub was interrupted");
        }
    }

    private JsonNode postJson(String path, String token, String json) {
        return requestJson("POST", path, token, json);
    }

    /** Pulls the human-readable message out of a GitHub error response body. */
    private String githubMessage(String body, String fallback) {
        try {
            JsonNode n = mapper.readTree(body == null ? "" : body);
            String msg = n.path("message").asText("");
            if (!msg.isBlank()) {
                String details = n.path("errors").get(0).path("message").asText("");
                return msg + (details.isBlank() ? "" : " — " + details);
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }

    /** Create an issue in the repo. */
    public IssueDto createIssue(String owner, String repo, String token, String title, String body) {
        String json = String.format(
                "{\"title\":%s,\"body\":%s}",
                mapper.valueToTree(title), mapper.valueToTree(body));
        return IssueDto.from(postJson("/repos/" + owner + "/" + repo + "/issues", token, json));
    }

    /** All branches of the repo (for the pull-request form's base/head pickers). */
    public List<BranchDto> listBranches(String owner, String repo, String token) {
        JsonNode root = getJson("/repos/" + owner + "/" + repo + "/branches?per_page=100", token);
        List<BranchDto> branches = new ArrayList<>();
        root.forEach(n -> branches.add(new BranchDto(n.path("name").asText())));
        return branches;
    }

    /** Open a pull request from head into base. */
    public PullDto createPull(String owner, String repo, String token,
                              String title, String head, String base, String body, boolean draft) {
        String json = String.format(
                "{\"title\":%s,\"head\":%s,\"base\":%s,\"body\":%s,\"draft\":%b}",
                mapper.valueToTree(title), mapper.valueToTree(head),
                mapper.valueToTree(base), mapper.valueToTree(body), draft);
        return PullDto.from(postJson("/repos/" + owner + "/" + repo + "/pulls", token, json));
    }

    /**
     * Invite a GitHub user as a collaborator (push permission) on the repo.
     * This is how approved project members get write access to a PRIVATE repo:
     * the repo owner's token sends the invite, the member's own token accepts it.
     *
     * @return true when a new invitation was created; false when the user
     *         already is a collaborator (HTTP 204)
     */
    public boolean inviteCollaborator(String owner, String repo, String token, String githubLogin) {
        JsonNode result = requestJson("PUT",
                "/repos/" + owner + "/" + repo + "/collaborators/" + githubLogin,
                token, "{\"permission\":\"push\"}");
        // 201 = invitation created, 204 = already a collaborator
        return result != null && result.hasNonNull("id");
    }

    /**
     * Accepts a pending repository invitation with the MEMBER's own token
     * (invitations can only be accepted by the invited user).
     *
     * @return true when an invitation for this repo was found and accepted
     */
    public boolean acceptRepoInvitation(String token, String owner, String repo) {
        JsonNode root = getJson("/user/repository_invitations?per_page=100", token);
        for (JsonNode inv : root) {
            JsonNode r = inv.path("repository");
            boolean matches = owner.equalsIgnoreCase(r.path("owner").path("login").asText())
                    && repo.equalsIgnoreCase(r.path("name").asText());
            if (matches) {
                requestJson("PATCH", "/user/repository_invitations/" + inv.path("id").asLong(), token, null);
                return true;
            }
        }
        return false;
    }

    /** Single issue by number. If the number belongs to a PR, its PR data is returned instead. */
    public IssueDto getIssue(String owner, String repo, long number, String token) {
        JsonNode n = getJson("/repos/" + owner + "/" + repo + "/issues/" + number, token);
        if (n.has("pull_request")) {
            JsonNode pr = getJson("/repos/" + owner + "/" + repo + "/pulls/" + number, token);
            return new IssueDto(
                    number,
                    pr.path("title").asText(),
                    pr.path("state").asText(),
                    pr.path("user").path("login").asText(null),
                    pr.path("created_at").asText(null),
                    pr.path("updated_at").asText(null),
                    pr.path("html_url").asText(null),
                    pr.path("body").asText(null),
                    0,
                    List.of());
        }
        return IssueDto.from(n);
    }
}
