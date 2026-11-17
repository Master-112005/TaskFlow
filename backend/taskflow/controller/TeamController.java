package taskflow.controller;

import taskflow.dto.ProjectDtos.MemberDto;
import taskflow.dto.ProjectDtos.TeamLeadDto;
import taskflow.model.Project;
import taskflow.model.ProjectMember;
import taskflow.model.Role;
import taskflow.model.User;
import taskflow.model.UserType;
import taskflow.repository.ProjectMemberRepository;
import taskflow.repository.ProjectRepository;
import taskflow.repository.UserRepository;
import taskflow.service.AccessService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Team panel for managers: every team lead on the left and, for the selected
 * lead, all the normal-user members working in the lead's projects on the right.
 */
@RestController
@RequestMapping("/api/team")
public class TeamController {

    private final UserRepository users;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final AccessService access;

    public TeamController(UserRepository users, ProjectRepository projects,
                          ProjectMemberRepository members, AccessService access) {
        this.users = users;
        this.projects = projects;
        this.members = members;
        this.access = access;
    }

    /** All team leads, with how many projects and members each one has. */
    @GetMapping("/leads")
    public List<TeamLeadDto> leads(Authentication auth) {
        User me = access.requireUser(auth);
        requirePanelAccess(me);

        List<TeamLeadDto> result = new ArrayList<>();
        for (User lead : users.findByRole(Role.TEAM_LEAD)) {
            List<Project> leadProjects = projects.findByCreatedByOrderByCreatedAtDesc(lead);
            Set<User> teamMembers = collectMembers(leadProjects);
            result.add(new TeamLeadDto(
                    lead.getId(), lead.getName(), lead.getEmail(), lead.getRole().name(), lead.getAvatar(),
                    leadProjects.size(), teamMembers.size()));
        }
        return result;
    }

    /**
     * Members under the team leads. With ?leadId={id} only that lead's members are
     * returned; without it, the members of every team lead (the default view).
     */
    @GetMapping("/members")
    public List<MemberDto> members(@RequestParam(required = false) Long leadId, Authentication auth) {
        User me = access.requireUser(auth);
        requirePanelAccess(me);

        List<Project> scope = new ArrayList<>();
        if (leadId != null) {
            User lead = users.findById(leadId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Team lead not found"));
            if (lead.getRole() != Role.TEAM_LEAD) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This user is not a team lead");
            }
            scope.addAll(projects.findByCreatedByOrderByCreatedAtDesc(lead));
        } else {
            for (User lead : users.findByRole(Role.TEAM_LEAD)) {
                scope.addAll(projects.findByCreatedByOrderByCreatedAtDesc(lead));
            }
        }
        return collectMembers(scope).stream().map(MemberDto::from).toList();
    }

    private Set<User> collectMembers(List<Project> scope) {
        Set<User> result = new LinkedHashSet<>();
        for (Project project : scope) {
            for (ProjectMember m : members.findByProject(project)) {
                if (m.getUser().getUserType() == UserType.NORMAL) {
                    result.add(m.getUser());
                }
            }
        }
        return result;
    }

    private void requirePanelAccess(User me) {
        if (me.getRole() != Role.MANAGER && me.getRole() != Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only managers can open the team panel");
        }
    }
}
