package taskflow.controller;

import taskflow.dto.GitHubDtos.BranchDto;
import taskflow.dto.GitHubDtos.CreateIssueRequest;
import taskflow.dto.GitHubDtos.CreatePullRequest;
import taskflow.dto.GitHubDtos.IssueDto;
import taskflow.dto.GitHubDtos.PullDto;
import taskflow.dto.GitHubDtos.RepoDto;
import taskflow.dto.ProjectDtos.CreateProjectRequest;
import taskflow.dto.ProjectDtos.JoinRequest;
import taskflow.dto.ProjectDtos.JoinRequestDto;
import taskflow.dto.ProjectDtos.JoinResponse;
import taskflow.dto.ProjectDtos.MemberDto;
import taskflow.dto.ProjectDtos.ProjectDto;
import taskflow.model.JoinStatus;
import taskflow.model.LinkedGithubAccount;
import taskflow.model.Project;
import taskflow.model.ProjectMember;
import taskflow.model.Role;
import taskflow.model.User;
import taskflow.repository.JoinRequestRepository;
import taskflow.repository.LinkedGithubAccountRepository;
import taskflow.repository.ProjectMemberRepository;
import taskflow.repository.ProjectRepository;
import taskflow.repository.UserRepository;
import taskflow.service.AccessService;
import taskflow.service.GitHubService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 6;

    /** Roles that belong to the admin side and may approve join requests. */
    private static final Set<Role> APPROVER_ROLES = Set.of(Role.TEAM_LEAD, Role.ADMIN, Role.MANAGER);

    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final JoinRequestRepository joinRequests;
    private final LinkedGithubAccountRepository linkedAccounts;
    private final UserRepository users;
    private final AccessService access;
    private final GitHubService gitHub;

    private final SecureRandom random = new SecureRandom();

    public ProjectController(ProjectRepository projects, ProjectMemberRepository members,
                             JoinRequestRepository joinRequests, LinkedGithubAccountRepository linkedAccounts,
                             UserRepository users, AccessService access, GitHubService gitHub) {
        this.projects = projects;
        this.members = members;
        this.joinRequests = joinRequests;
        this.linkedAccounts = linkedAccounts;
        this.users = users;
        this.access = access;
        this.gitHub = gitHub;
    }

    /** Admin/lead/manager: list their GitHub repositories to pick a project from. */
    @GetMapping("/github/repos")
    public List<RepoDto> myGithubRepos(@RequestParam(required = false) Long accountId, Authentication auth) {
        User user = access.requireUser(auth);
        access.requireAdmin(user);
        String token = resolveToken(user, accountId);
        return gitHub.listMyRepos(token);
    }

    /** Active GitHub token: the one from ?accountId= when given, else the user's active token. */
    private String resolveToken(User user, Long accountId) {
        if (accountId == null) {
            if (user.getGithubToken() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Connect your GitHub account first");
            }
            return user.getGithubToken();
        }
        LinkedGithubAccount account = linkedAccounts.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Linked account not found"));
        if (!account.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account belongs to another user");
        }
        if (!LinkedGithubAccount.GITHUB.equals(account.getProvider())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only GitHub accounts can be used for repositories");
        }
        return account.getToken();
    }

    /** Admin/lead/manager: select a GitHub repo -> project is created and an invite code is generated. */
    @PostMapping
    public ProjectDto create(@Valid @RequestBody CreateProjectRequest request, Authentication auth) {
        User user = access.requireUser(auth);
        access.requireAdmin(user);

        // The project is tied to the account whose repo was picked — not
        // necessarily the user's active account.
        String token = resolveToken(user, request.accountId());
        RepoDto repo = gitHub.getRepo(request.repoOwner().trim(), request.repoName().trim(), token);

        Project project = new Project();
        project.setName(repo.name());
        project.setRepoOwner(repo.owner());
        project.setRepoName(repo.name());
        project.setGithubToken(token);
        project.setInviteCode(generateUniqueCode());
        project.setCreatedBy(user);
        projects.save(project);

        // creator is implicitly a member
        joinProject(project, user);
        return ProjectDto.from(project, 1);
    }

    /** Projects the current user created (admins) or joined via code (everyone). */
    @GetMapping("/my")
    public List<ProjectDto> mine(Authentication auth) {
        User user = access.requireUser(auth);
        Map<Long, Project> result = new LinkedHashMap<>();

        if (user.getUserType() == taskflow.model.UserType.ADMIN) {
            projects.findByCreatedByOrderByCreatedAtDesc(user)
                    .forEach(p -> result.put(p.getId(), p));
        }
        members.findByUserOrderByJoinedAtDesc(user)
                .forEach(m -> result.putIfAbsent(m.getProject().getId(), m.getProject()));

        List<ProjectDto> dtos = new ArrayList<>();
        for (Project p : result.values()) {
            dtos.add(ProjectDto.from(p, members.findByProject(p).size()));
        }
        return dtos;
    }

    /**
     * Normal user: enter the code given by a manager/lead. This no longer adds the
     * user directly: a PENDING join request is created and the project admin has to
     * approve it on their home page before the user can enter the project.
     */
    @PostMapping("/join")
    public JoinResponse join(@Valid @RequestBody JoinRequest request, Authentication auth) {
        User user = access.requireUser(auth);
        Project project = projects.findByInviteCodeIgnoreCase(request.code().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid code — no project found"));

        if (members.existsByProjectAndUser(project, user)) {
            return JoinResponse.joined(ProjectDto.from(project, members.findByProject(project).size()));
        }
        if (joinRequests.findByProjectAndUserAndStatus(project, user, JoinStatus.PENDING).isEmpty()) {
            taskflow.model.JoinRequest jr = new taskflow.model.JoinRequest();
            jr.setProject(project);
            jr.setUser(user);
            joinRequests.save(jr);
        }
        return JoinResponse.pending();
    }

    /** Pending join requests for the projects this admin created (or helps manage). */
    @GetMapping("/join-requests")
    public List<JoinRequestDto> pendingJoinRequests(Authentication auth) {
        User admin = access.requireUser(auth);
        access.requireAdmin(admin);

        Set<Project> mine = new LinkedHashSet<>();
        projects.findByCreatedByOrderByCreatedAtDesc(admin).forEach(mine::add);
        members.findByUserOrderByJoinedAtDesc(admin).stream()
                .filter(m -> APPROVER_ROLES.contains(m.getUser().getRole()))
                .forEach(m -> mine.add(m.getProject()));

        if (mine.isEmpty()) {
            return List.of();
        }
        return joinRequests.findByProjectInAndStatusOrderByRequestedAtAsc(mine, JoinStatus.PENDING)
                .stream().map(JoinRequestDto::from).toList();
    }

    /** Pending join requests for one specific project (opened from the project page). */
    @GetMapping("/{id}/join-requests")
    public List<JoinRequestDto> projectPendingRequests(@PathVariable long id, Authentication auth) {
        User admin = access.requireUser(auth);
        access.requireAdmin(admin);
        Project project = access.requireAccess(id, admin);
        return joinRequests.findByProjectAndStatusOrderByRequestedAtAsc(project, JoinStatus.PENDING)
                .stream().map(JoinRequestDto::from).toList();
    }

    /** Approve a join request: the requester becomes a project member. */
    @PostMapping("/join-requests/{id}/approve")
    public void approve(@PathVariable long id, Authentication auth) {
        decide(id, auth, JoinStatus.ACCEPTED);
    }

    /** Reject a join request: the user can ask again later. */
    @PostMapping("/join-requests/{id}/reject")
    public void reject(@PathVariable long id, Authentication auth) {
        decide(id, auth, JoinStatus.REJECTED);
    }

    private void decide(long id, Authentication auth, JoinStatus decision) {
        User admin = access.requireUser(auth);
        access.requireAdmin(admin);
        taskflow.model.JoinRequest jr = joinRequests.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Join request not found"));
        if (!canManage(admin, jr.getProject())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only this project's admins can handle requests");
        }
        if (jr.getStatus() != JoinStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This request was already handled");
        }
        jr.setStatus(decision);
        joinRequests.save(jr);
        if (decision == JoinStatus.ACCEPTED) {
            joinProject(jr.getProject(), jr.getUser());
        }
    }

    /** Creator of the project, or a member with an admin-side role. */
    private boolean canManage(User admin, Project project) {
        if (project.getCreatedBy().getId().equals(admin.getId())) {
            return true;
        }
        return members.findByProjectAndUser(project, admin)
                .map(m -> APPROVER_ROLES.contains(m.getUser().getRole()))
                .orElse(false);
    }

    @GetMapping("/{id}")
    public ProjectDto details(@PathVariable long id, Authentication auth) {
        Project project = access.requireAccess(id, access.requireUser(auth));
        return ProjectDto.from(project, members.findByProject(project).size());
    }

    /** Team members of the project (used for @mention popups). */
    @GetMapping("/{id}/members")
    public List<MemberDto> members(@PathVariable long id, Authentication auth) {
        Project project = access.requireAccess(id, access.requireUser(auth));
        return members.findByProject(project).stream()
                .map(m -> MemberDto.from(m.getUser()))
                .toList();
    }

    /** Remove a teammate from the project (admins only; the creator cannot be removed). */
    @DeleteMapping("/{id}/members/{userId}")
    public void removeMember(@PathVariable long id, @PathVariable long userId, Authentication auth) {
        User admin = access.requireUser(auth);
        access.requireAdmin(admin);
        Project project = access.requireAccess(id, admin);

        if (project.getCreatedBy().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The project creator cannot be removed");
        }
        ProjectMember member = members.findByProjectAndUser(project, users.findById(userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This user is not a member"));
        members.delete(member);
    }

    @GetMapping("/{id}/issues")
    public List<IssueDto> issues(@PathVariable long id, Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        return readWithFallback(user, project,
                () -> gitHub.listIssues(project.getRepoOwner(), project.getRepoName(), project.getGithubToken()),
                () -> gitHub.listIssues(project.getRepoOwner(), project.getRepoName(), user.getGithubToken()));
    }

    /** Single issue (used when someone clicks #123 in the chat). */
    @GetMapping("/{id}/issues/{number}")
    public IssueDto issue(@PathVariable long id, @PathVariable long number, Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        return readWithFallback(user, project,
                () -> gitHub.getIssue(project.getRepoOwner(), project.getRepoName(), number, project.getGithubToken()),
                () -> gitHub.getIssue(project.getRepoOwner(), project.getRepoName(), number, user.getGithubToken()));
    }

    /** Create a new issue in the project's repo (any team member). */
    @PostMapping("/{id}/issues")
    public IssueDto createIssue(@PathVariable long id, @Valid @RequestBody CreateIssueRequest request,
                                Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        String title = request.title().trim();
        String body = request.body() == null ? "" : request.body().trim();
        return withProjectFallback(user, project,
                () -> gitHub.createIssue(project.getRepoOwner(), project.getRepoName(), user.getGithubToken(), title, body),
                () -> gitHub.createIssue(project.getRepoOwner(), project.getRepoName(), project.getGithubToken(), title, body));
    }

    /** Branches of the project's repo (for the pull-request form). */
    @GetMapping("/{id}/branches")
    public List<BranchDto> branches(@PathVariable long id, Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        return readWithFallback(user, project,
                () -> gitHub.listBranches(project.getRepoOwner(), project.getRepoName(), project.getGithubToken()),
                () -> gitHub.listBranches(project.getRepoOwner(), project.getRepoName(), user.getGithubToken()));
    }

    /** Open a pull request in the project's repo (any team member). */
    @PostMapping("/{id}/pulls")
    public PullDto createPull(@PathVariable long id, @Valid @RequestBody CreatePullRequest request,
                              Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        String title = request.title().trim();
        String head = request.head().trim();
        String base = request.base().trim();
        String body = request.body() == null ? "" : request.body().trim();
        boolean draft = Boolean.TRUE.equals(request.draft());
        return withProjectFallback(user, project,
                () -> gitHub.createPull(project.getRepoOwner(), project.getRepoName(), user.getGithubToken(), title, head, base, body, draft),
                () -> gitHub.createPull(project.getRepoOwner(), project.getRepoName(), project.getGithubToken(), title, head, base, body, draft));
    }

    /**
     * Creates issues / pull requests with the acting user's own GitHub token so
     * GitHub attributes them to that account. If that token is dead (expired /
     * revoked) or lacks access to the project's repo, it transparently retries
     * with the project's stored token so the team member is never blocked.
     */
    private <T> T withProjectFallback(User user, Project project,
                                      java.util.function.Supplier<T> withUserToken,
                                      java.util.function.Supplier<T> withProjectToken) {
        if (user.getGithubToken() == null || user.getGithubToken().isBlank()) {
            return withProjectToken.get();
        }
        try {
            return withUserToken.get();
        } catch (ResponseStatusException e) {
            if (retryWithFallback(e) && hasText(project.getGithubToken())) {
                return withProjectToken.get();
            }
            throw e;
        }
    }

    /**
     * Reads (issue / pull request / branch lists) normally use the project's
     * stored token. If that token is dead or lacks access, they transparently
     * retry with the acting member's own GitHub token — so the list keeps
     * working for members even when the project's connection broke.
     */
    private <T> T readWithFallback(User user, Project project,
                                   java.util.function.Supplier<T> withProjectToken,
                                   java.util.function.Supplier<T> withUserToken) {
        if (project.getGithubToken() == null || project.getGithubToken().isBlank()) {
            return withUserToken.get();
        }
        try {
            return withProjectToken.get();
        } catch (ResponseStatusException e) {
            if (retryWithFallback(e) && hasText(user.getGithubToken())) {
                return withUserToken.get();
            }
            throw e;
        }
    }

    /** Fall back when GitHub rejected the token (400) or lacks repo access (403). */
    private boolean retryWithFallback(ResponseStatusException e) {
        return e.getStatusCode() == HttpStatus.BAD_REQUEST || e.getStatusCode() == HttpStatus.FORBIDDEN;
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    @GetMapping("/{id}/pulls")
    public List<PullDto> pulls(@PathVariable long id, Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(id, user);
        return readWithFallback(user, project,
                () -> gitHub.listPulls(project.getRepoOwner(), project.getRepoName(), project.getGithubToken()),
                () -> gitHub.listPulls(project.getRepoOwner(), project.getRepoName(), user.getGithubToken()));
    }

    private void joinProject(Project project, User user) {
        if (!members.existsByProjectAndUser(project, user)) {
            ProjectMember member = new ProjectMember();
            member.setProject(project);
            member.setUser(user);
            members.save(member);
        }
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 50; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (projects.findByInviteCodeIgnoreCase(code).isEmpty()) {
                return code;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate a unique code");
    }
}
