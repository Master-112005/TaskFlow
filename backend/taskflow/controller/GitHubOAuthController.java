package taskflow.controller;

import taskflow.dto.GitHubDtos.LinkedAccountDto;
import taskflow.model.LinkedGithubAccount;
import taskflow.model.User;
import taskflow.repository.LinkedGithubAccountRepository;
import taskflow.service.AccessService;
import taskflow.service.GitHubOAuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
public class GitHubOAuthController {

    private final GitHubOAuthService oauth;
    private final AccessService access;
    private final LinkedGithubAccountRepository linkedAccounts;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public GitHubOAuthController(GitHubOAuthService oauth, AccessService access,
                                 LinkedGithubAccountRepository linkedAccounts) {
        this.oauth = oauth;
        this.access = access;
        this.linkedAccounts = linkedAccounts;
    }

    /** "Connect GitHub" -> frontend opens this GitHub consent URL (admins and normal users). */
    @GetMapping("/api/github/connect-url")
    public Map<String, String> connectUrl(@RequestParam(required = false) String returnTo,
                                          @RequestParam(required = false) String picker,
                                          Authentication auth) {
        User user = access.requireUser(auth);
        // The OAuth redirect may only land on one of these pages: the profile
        // (account linking), the admin home, or the project page (lead
        // connecting the repository).
        String target = "/profile".equals(returnTo) ? "/profile" : "/admin";
        if (returnTo != null && returnTo.matches("^/project/\\d+$")) {
            target = returnTo;
        }
        // picker=select forces GitHub's account picker (needed when adding another account).
        boolean selectAccount = "select".equals(picker);
        return Map.of("url", oauth.buildAuthorizeUrl(user, target, selectAccount));
    }

    /** All accounts linked to the current user (profile page, repo picker). */
    @GetMapping("/api/github/accounts")
    public List<LinkedAccountDto> accounts(Authentication auth) {
        User user = access.requireUser(auth);
        return oauth.listAccounts(user);
    }

    /** Remove one linked account (GitHub or LinkedIn); another one becomes active, or none. */
    @PostMapping("/api/github/accounts/{id}/remove")
    public Map<String, Object> removeAccount(@PathVariable long id, Authentication auth) {
        User user = access.requireUser(auth);
        boolean activeChanged = oauth.removeAccount(user, id);
        return Map.of("removed", true, "activeChanged", activeChanged);
    }

    /** Add a LinkedIn account by pasting the profile link (no OAuth needed). */
    @PostMapping("/api/accounts/linkedin")
    public LinkedAccountDto addLinkedIn(@RequestBody Map<String, String> body, Authentication auth) {
        User user = access.requireUser(auth);
        return oauth.addLinkedIn(user, body.get("url"));
    }

    /** GitHub redirects here after the user approves (public — no JWT header). */
    @GetMapping("/api/github/oauth/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                         @RequestParam(required = false) String state) {
        String target;
        try {
            GitHubOAuthService.Connected connected = oauth.complete(code, state);
            // land back on the page that started the flow (profile "Add account" or admin home)
            String landing = connected.existed()
                    ? "?github=already&login=" + connected.login()
                    : "?github=connected&login=" + connected.login();
            target = frontendUrl + connected.returnTo() + landing;
        } catch (Exception e) {
            // /profile is reachable for both admins and normal users
            target = frontendUrl + "/profile?github=error";
        }
        return ResponseEntity.status(302).location(URI.create(target)).build();
    }
}
