package taskflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import taskflow.dto.GitHubDtos.LinkedAccountDto;
import taskflow.model.LinkedGithubAccount;
import taskflow.model.Project;
import taskflow.model.User;
import taskflow.model.UserType;
import taskflow.repository.LinkedGithubAccountRepository;
import taskflow.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * GitHub OAuth ("Sign in with GitHub" style) flow for all users:
 * 1. buildAuthorizeUrl() -> GitHub consent screen (state carries who is connecting)
 * 2. GitHub redirects to /api/github/oauth/callback with ?code&state
 * 3. complete() exchanges the code for an access token and stores it on the user.
 */
@Service
public class GitHubOAuthService {

    /** A user can link at most this many GitHub accounts. */
    public static final int MAX_GITHUB_ACCOUNTS = 3;

    /** Normal users can link only one GitHub account (admins up to MAX_GITHUB_ACCOUNTS). */
    public static final int MAX_GITHUB_ACCOUNTS_NORMAL = 1;

    /** GitHub limit for this user: normal users get one account, admins get three. */
    public int maxGitHubAccounts(User user) {
        return user.getUserType() == UserType.NORMAL
                ? MAX_GITHUB_ACCOUNTS_NORMAL
                : MAX_GITHUB_ACCOUNTS;
    }

    private record Pending(String email, Instant createdAt, String returnTo) {
    }

    /** Result of finishing the OAuth flow: which GitHub login connected, whether it was already linked, and where to land. */
    public record Connected(String login, boolean existed, String returnTo) {
    }

    @Value("${app.github.client-id}")
    private String clientId;

    @Value("${app.github.client-secret}")
    private String clientSecret;

    @Value("${app.github.redirect-uri}")
    private String redirectUri;

    private final UserRepository users;
    private final LinkedGithubAccountRepository linkedAccounts;
    private final taskflow.repository.ProjectRepository projects;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final SecureRandom random = new SecureRandom();
    /** state -> who started the flow (in-memory, expires after 10 minutes). */
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();

    public GitHubOAuthService(UserRepository users, LinkedGithubAccountRepository linkedAccounts,
                              taskflow.repository.ProjectRepository projects) {
        this.users = users;
        this.linkedAccounts = linkedAccounts;
        this.projects = projects;
    }

    public String buildAuthorizeUrl(User user, String returnTo, boolean selectAccount) {
        String state = newState();
        pending.put(state, new Pending(user.getEmail(), Instant.now(), returnTo == null ? "/admin" : returnTo));

        // drop stale entries (>10 min)
        pending.entrySet().removeIf(e ->
                Duration.between(e.getValue().createdAt(), Instant.now()).toMinutes() > 10);

        // prompt=select_account makes GitHub show its account picker so the user
        // can connect another GitHub account without logging out of the current one.
        String prompt = selectAccount ? "&prompt=select_account" : "";

        return "https://github.com/login/oauth/authorize"
                + "?client_id=" + enc(clientId)
                + "&redirect_uri=" + enc(redirectUri)
                + "&scope=" + enc("repo read:user")
                + "&state=" + state
                + "&allow_signup=false"
                + prompt;
    }

    /**
     * Exchanges the OAuth code for an access token, validates it against
     * /user and links the GitHub account to the connecting TaskFlow user.
     *
     * Every connected account is stored in linked_github_accounts (a user can
     * link several GitHub accounts). user.githubToken — the "active" account —
     * is only set when the user has no active account yet, so connecting an
     * extra account never switches the default one.
     *
     * @return the GitHub login and whether that account was already linked
     */
    public Connected complete(String code, String state) {
        Pending p = state != null ? pending.remove(state) : null;
        if (p == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown or expired GitHub sign-in state — please try connecting again");
        }

        String accessToken = exchangeCode(code);
        String login = fetchLogin(accessToken);

        User user = users.findByEmail(p.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User no longer exists"));

        // Upsert the linked account (re-connecting refreshes the token).
        LinkedGithubAccount existing = linkedAccounts.findByUserAndUsername(user, login).orElse(null);
        // Capture the tokens this user had for THIS GitHub login before the
        // refresh — they may still be stored on the user's active pointer and
        // on projects this user created; they must be replaced by the new token.
        List<String> staleTokens = new java.util.ArrayList<>();
        if (existing != null && existing.getToken() != null) {
            staleTokens.add(existing.getToken());
        }
        if (user.getGithubToken() != null && linkedAccounts.findByUserAndToken(user, user.getGithubToken())
                .map(a -> login.equals(a.getUsername())).orElse(false)) {
            staleTokens.add(user.getGithubToken());
        }
        if (existing == null) {
            // limit: normal users one GitHub account, admins up to three
            long count = linkedAccounts.findByUserOrderByConnectedAtAsc(user).stream()
                    .filter(a -> LinkedGithubAccount.GITHUB.equals(a.getProvider()))
                    .count();
            int max = maxGitHubAccounts(user);
            if (count >= max) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        max == 1
                                ? "Normal users can link only one GitHub account — remove it first to link another"
                                : "You can link up to " + max + " GitHub accounts — remove one first");
            }
        }
        LinkedGithubAccount account = existing != null ? existing : new LinkedGithubAccount();
        if (existing == null) {
            account.setUser(user);
            account.setUsername(login);
            account.setProvider(LinkedGithubAccount.GITHUB);
        }
        account.setToken(accessToken);
        linkedAccounts.save(account);

        // Refresh the user's active pointer when it pointed at this login's old
        // (now stale) token — re-connecting must heal the default account too.
        if (user.getGithubToken() == null || staleTokens.contains(user.getGithubToken())) {
            user.setGithubToken(accessToken);
        }
        users.save(user);

        // Heal projects whose stored token is the old one: projects read/write
        // GitHub through this token, so a stale token would break Issues and
        // Pull Requests for the whole team until someone re-connected.
        if (!staleTokens.isEmpty()) {
            for (String stale : staleTokens) {
                for (Project project : projects.findByGithubToken(stale)) {
                    project.setGithubToken(accessToken);
                    projects.save(project);
                }
            }
        }

        return new Connected(login, existing != null, p.returnTo());
    }

    private String exchangeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GitHub did not send an authorization code");
        }
        try {
            var payload = mapper.createObjectNode()
                    .put("client_id", clientId)
                    .put("client_secret", clientSecret)
                    .put("code", code)
                    .put("redirect_uri", redirectUri);

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://github.com/login/oauth/access_token"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = mapper.readTree(response.body());

            if (json.path("access_token").asText("").isBlank()) {
                String error = json.path("error_description").asText(json.path("error").asText("unknown error"));
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GitHub token exchange failed: " + error);
            }
            return json.path("access_token").asText();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub: " + e.getMessage());
        }
    }

    private String fetchLogin(String accessToken) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.github.com/user"))
                    .timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "TaskFlow")
                    .header("Authorization", "Bearer " + accessToken)
                    .GET()
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "The exchanged GitHub token is not valid (HTTP " + response.statusCode() + ")");
            }
            return mapper.readTree(response.body()).path("login").asText();
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub: " + e.getMessage());
        }
    }

    /**
     * All GitHub accounts linked to this user. Legacy users that only have the
     * old user.githubToken are migrated on the fly: their token is looked up
     * against GitHub and stored as a proper linked account.
     */
    public List<LinkedAccountDto> listAccounts(User user) {
        if (user.getGithubToken() != null && linkedAccounts.findByUserAndToken(user, user.getGithubToken()).isEmpty()) {
            try {
                String login = fetchLogin(user.getGithubToken());
                LinkedGithubAccount legacy = linkedAccounts.findByUserAndUsername(user, login)
                        .orElseGet(() -> {
                            LinkedGithubAccount fresh = new LinkedGithubAccount();
                            fresh.setUser(user);
                            fresh.setUsername(login);
                            return fresh;
                        });
                legacy.setToken(user.getGithubToken());
                linkedAccounts.save(legacy);
            } catch (Exception ignored) {
                // The stored token may simply be revoked; the rest of the list still works.
            }
        }
        return linkedAccounts.findByUserOrderByConnectedAtAsc(user).stream()
                .map(a -> LinkedAccountDto.from(a, user.getGithubToken()))
                .toList();
    }

    /**
     * Adds a LinkedIn account by pasting the profile link — no OAuth needed.
     * Validates the link, rejects duplicates and keeps at most 3 entries overall.
     */
    public LinkedAccountDto addLinkedIn(User user, String rawUrl) {
        String url = rawUrl == null ? "" : rawUrl.trim();
        if (url.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paste your LinkedIn profile link");
        }
        if (!url.matches("(?i)^https?://([a-z0-9-]+\\.)?linkedin\\.com/.*")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That does not look like a LinkedIn profile link (expected linkedin.com/…)");
        }
        if (url.length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The link is too long");
        }
        if (linkedAccounts.findByUserAndUsername(user, url).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This LinkedIn profile is already added");
        }
        if (linkedAccounts.findByUserOrderByConnectedAtAsc(user).size() >= MAX_GITHUB_ACCOUNTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You can add up to " + MAX_GITHUB_ACCOUNTS + " accounts — remove one first");
        }

        LinkedGithubAccount row = new LinkedGithubAccount();
        row.setUser(user);
        row.setUsername(url);
        row.setProvider(LinkedGithubAccount.LINKEDIN);
        linkedAccounts.save(row);
        return LinkedAccountDto.from(row, user.getGithubToken());
    }

    /**
     * Removes a linked GitHub account. If it was the active one
     * (user.githubToken), another remaining account becomes active,
     * or the active token becomes null when it was the last one.
     *
     * @return true when the user's active account changed
     */
    public boolean removeAccount(User user, long accountId) {
        LinkedGithubAccount account = linkedAccounts.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked account not found"));
        if (!account.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account belongs to another user");
        }

        boolean wasActive = user.getGithubToken() != null && user.getGithubToken().equals(account.getToken());
        linkedAccounts.delete(account);

        if (wasActive) {
            List<LinkedGithubAccount> remaining = linkedAccounts.findByUserOrderByConnectedAtAsc(user);
            user.setGithubToken(remaining.isEmpty() ? null : remaining.get(remaining.size() - 1).getToken());
            users.save(user);
            return true;
        }
        return false;
    }

    private String newState() {
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
