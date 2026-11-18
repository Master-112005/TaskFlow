package taskflow.repository;

import taskflow.model.Project;
import taskflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByInviteCodeIgnoreCase(String inviteCode);
    List<Project> findByCreatedByOrderByCreatedAtDesc(User user);
    List<Project> findByGithubToken(String githubToken);
}
