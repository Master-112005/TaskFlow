package taskflow.repository;

import taskflow.model.JoinRequest;
import taskflow.model.JoinStatus;
import taskflow.model.Project;
import taskflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JoinRequestRepository extends JpaRepository<JoinRequest, Long> {

    Optional<JoinRequest> findByProjectAndUserAndStatus(Project project, User user, JoinStatus status);

    List<JoinRequest> findByProjectAndStatusOrderByRequestedAtAsc(Project project, JoinStatus status);

    List<JoinRequest> findByProjectInAndStatusOrderByRequestedAtAsc(Collection<Project> projects, JoinStatus status);

    List<JoinRequest> findByUserOrderByRequestedAtDesc(User user);
}
