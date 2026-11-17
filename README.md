# ⚡ TaskFlow

A collaboration web app for software teams. Admins / leads / managers connect a GitHub
repository and get an invite code; developers, testers and dev-team members enter the
code and get a shared team **chat** plus the repo's **Issues** and **Pull Requests**.

- **Frontend:** React (Vite) — `frontend/`
- **Backend:** Java 17 / Spring Boot 4 — `backend/` (`pom.xml`, `mvnw`, code in `backend/taskflow/`)
- **Database:** MySQL
- **GitHub access:** GitHub OAuth (one-click connect, no tokens to paste)

## User types

| Type | Who | Roles at registration | Powers |
|------|-----|----------------------|--------|
| Normal user | Developers, testers, dev team | Frontend Dev, Backend Dev, Tester, Dev Team | Enter an invite code → project chat + issues/PRs. Profile top-right. |
| Admin user | Team leads, admins, managers | Team Lead, Admin, Manager | Pick a GitHub repo (via PAT) → project is created, a code is generated to share. Same project view as normal users. |

## Prerequisites

- Java 17+ (JDK 24 works)
- Node.js 18+
- MySQL running on `localhost:3306` (database `taskflowdb` is auto-created)
- A GitHub **OAuth App**: create one at <https://github.com/settings/developers> with
  - **Homepage URL:** `http://localhost:5173`
  - **Authorization callback URL:** `http://localhost:8080/api/github/oauth/callback`

Then put its Client ID and Client Secret into `backend/src/main/resources/application.properties`
(`app.github.client-id` / `app.github.client-secret`).

## Configure

Edit `backend/src/main/resources/application.properties`:

```properties
spring.datasource.username=root
spring.datasource.password=YOUR_MYSQL_PASSWORD
app.github.client-id=YOUR_GITHUB_CLIENT_ID
app.github.client-secret=YOUR_GITHUB_CLIENT_SECRET
```

## Run the backend

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

First run downloads Maven automatically. Backend listens on `http://localhost:8080`.

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Try it out

1. Register an **Admin user** (Team Lead / Admin / Manager).
2. On the admin home: click **Connect GitHub** → approve on GitHub →
   back on the admin page, *Load my repositories*, pick one →
   **Create project & generate code**. Share the 6-character code.
3. Register a **Normal user** (or several), enter the code on their home page.
4. Inside the project: team chat in the middle, **Issues** and **Pull Requests**
   in the top right. Invite code stays visible (top bar) for admins.
