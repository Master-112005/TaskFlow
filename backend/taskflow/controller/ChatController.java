package taskflow.controller;

import taskflow.dto.ProjectDtos.MessageDto;
import taskflow.dto.ProjectDtos.SendMessageRequest;
import taskflow.model.Message;
import taskflow.model.Project;
import taskflow.model.User;
import taskflow.repository.MessageRepository;
import taskflow.repository.ProjectMemberRepository;
import taskflow.repository.UserRepository;
import taskflow.service.AccessService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/messages")
public class ChatController {

    private final MessageRepository messages;
    private final UserRepository users;
    private final ProjectMemberRepository members;
    private final AccessService access;

    public ChatController(MessageRepository messages, UserRepository users,
                          ProjectMemberRepository members, AccessService access) {
        this.messages = messages;
        this.users = users;
        this.members = members;
        this.access = access;
    }

    /**
     * Chat for a project. Three modes:
     *  - no params            -> public project chat (latest 100)
     *  - ?after={lastId}      -> only new public messages (polling)
     *  - ?withUser={id}       -> private 1-to-1 thread with that project member
     */
    @GetMapping
    public List<MessageDto> list(@PathVariable long projectId,
                                 @RequestParam(required = false) Long after,
                                 @RequestParam(required = false) Long withUser,
                                 Authentication auth) {
        User me = access.requireUser(auth);
        Project project = access.requireAccess(projectId, me);

        if (withUser != null) {
            User other = users.findById(withUser)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            List<Message> dm = messages.findDirectMessages(project, me, other);
            if (after != null) {
                dm = dm.stream().filter(m -> m.getId() > after).toList();
            }
            return dm.stream().map(MessageDto::from).toList();
        }

        if (after != null) {
            return messages.findTop100ByProjectAndRecipientIsNullAndIdGreaterThanOrderByIdAsc(project, after)
                    .stream().map(MessageDto::from).toList();
        }
        List<Message> latest = messages.findTop100ByProjectAndRecipientIsNullOrderByIdDesc(project);
        Collections.reverse(latest);
        return latest.stream().map(MessageDto::from).toList();
    }

    @PostMapping
    public MessageDto post(@PathVariable long projectId,
                           @Valid @RequestBody SendMessageRequest request,
                           Authentication auth) {
        User user = access.requireUser(auth);
        Project project = access.requireAccess(projectId, user);

        Message message = new Message();
        message.setProject(project);
        message.setSender(user);
        message.setContent(request.content().trim());

        if (request.recipientId() != null) {
            if (request.recipientId().equals(user.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot DM yourself");
            }
            User recipient = users.findById(request.recipientId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            if (!members.existsByProjectAndUser(project, recipient)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That user is not a member of this project");
            }
            message.setRecipient(recipient);
        }

        messages.save(message);
        return MessageDto.from(message);
    }
}
