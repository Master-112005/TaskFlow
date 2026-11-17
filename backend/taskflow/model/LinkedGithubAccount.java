package taskflow.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * One account linked to a TaskFlow user: a GitHub account (via OAuth, with a
 * token) or a LinkedIn account (just the pasted profile link, no token).
 * A user may link up to 3 GitHub accounts; user.githubToken always points at
 * one of those (the "active" one) or stays null when none is linked.
 */
@Entity
@Table(name = "linked_github_accounts",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "username"}))
public class LinkedGithubAccount {

    /** Provider of the row: GITHUB (OAuth) or LINKEDIN (pasted profile link). */
    public static final String GITHUB = "GITHUB";
    public static final String LINKEDIN = "LINKEDIN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * GitHub login (e.g. "Master-112005") for OAuth rows, or the pasted
     * LinkedIn profile URL for LinkedIn rows. Unique per user.
     */
    @Column(nullable = false, length = 255)
    private String username;

    /** What kind of account this is: GITHUB or LINKEDIN (null in old rows = GITHUB). */
    @Column(length = 20)
    private String provider;

    /** OAuth access token of this GitHub account; null for LinkedIn rows. */
    @Lob
    @Column
    private String token;

    @Column(nullable = false)
    private Instant connectedAt = Instant.now();

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getProvider() { return provider == null ? GITHUB : provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public Instant getConnectedAt() { return connectedAt; }
    public void setConnectedAt(Instant connectedAt) { this.connectedAt = connectedAt; }
}
