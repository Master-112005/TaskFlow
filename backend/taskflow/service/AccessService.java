package taskflow.service;

import taskflow.model.Project;
import taskflow.model.User;
import taskflow.repository.ProjectMemberRepository;
import taskflow.repository.ProjectRepository;
import taskflow.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Small helper used by the controllers to resolve the logged-in user
 * and to check who may open a project.
 */
@Service
public class AccessService {

    private final UserRepository users;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;

    public AccessService(UserRepository users, ProjectRepository projects, ProjectMemberRepository members) {
        this.users = users;
        this.projects = projects;
        this.members = members;
    }

    public User requireUser(Authentication auth) {
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in");
        }
        return users.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    public void requireAdmin(User user) {
        if (user.getUserType() != taskflow.model.UserType.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins, leads and managers can do this");
        }
    }

    /** Creator (admin) and joined members may open a project. */
    public Project requireAccess(long projectId, User user) {
        Project project = projects.findById(projectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        boolean creator = project.getCreatedBy().getId().equals(user.getId());
        if (!creator && !members.existsByProjectAndUser(project, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this project");
        }
        return project;
    }
}
