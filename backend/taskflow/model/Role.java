package taskflow.model;

public enum Role {
    // Normal users (developers, testers, dev team)
    FRONTEND_DEVELOPER,
    BACKEND_DEVELOPER,
    TESTER,
    DEV_TEAM,
    // Admin users (team leaders, admins, managers)
    TEAM_LEAD,
    ADMIN,
    MANAGER
}
