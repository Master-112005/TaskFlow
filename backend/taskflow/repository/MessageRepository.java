package taskflow.repository;

import taskflow.model.Message;
import taskflow.model.Project;
import taskflow.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    /** Public project chat (recipient is null). */
    List<Message> findTop100ByProjectAndRecipientIsNullOrderByIdDesc(Project project);
    List<Message> findTop100ByProjectAndRecipientIsNullAndIdGreaterThanOrderByIdAsc(Project project, Long id);

    /** Private 1-to-1 chat between two project members. */
    @Query("""
            select m from Message m
            where m.project = :project
              and ((m.sender = :me and m.recipient = :other) or (m.sender = :other and m.recipient = :me))
            order by m.id asc
            """)
    List<Message> findDirectMessages(@Param("project") Project project,
                                     @Param("me") User me,
                                     @Param("other") User other);
}
