package taskflow.repository;

import taskflow.model.Project;
import taskflow.model.ProjectMember;
import taskflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {
    boolean existsByProjectAndUser(Project project, User user);
    Optional<ProjectMember> findByProjectAndUser(Project project, User user);
    List<ProjectMember> findByUserOrderByJoinedAtDesc(User user);
    List<ProjectMember> findByProject(Project project);
}
