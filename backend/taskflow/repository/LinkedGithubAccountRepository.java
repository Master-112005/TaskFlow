package taskflow.repository;

import taskflow.model.LinkedGithubAccount;
import taskflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LinkedGithubAccountRepository extends JpaRepository<LinkedGithubAccount, Long> {

    /** All accounts of one user, oldest connection first (stable order in the UI). */
    List<LinkedGithubAccount> findByUserOrderByConnectedAtAsc(User user);

    Optional<LinkedGithubAccount> findByUserAndUsername(User user, String username);

    Optional<LinkedGithubAccount> findByUserAndToken(User user, String token);
}
