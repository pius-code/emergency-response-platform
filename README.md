# Emergency Response & Dispatch Coordination Platform

CPEN 421 – Mobile and Web Software Design and Architecture  
University of Ghana, School of Engineering Sciences

---

## Services

| Service | Port | Owner | Description |
|---|---|---|---|
| auth-service | 3001 | Person A | JWT auth, user management |
| incident-service | 3002 | Person A | Incident reporting, dispatch logic |
| dispatch-service | 3003 | Person B | GPS tracking, WebSockets |
| analytics-service | 3004 | Person B | Stats and monitoring |
| client | — | Person B | React web frontend |

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js v18+](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/emergency-response-platform.git
cd emergency-response-platform

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Start all services
docker compose up --build

# 4. Check everything is running
docker compose ps
```

### Useful URLs once running

| URL | What it is |
|---|---|
| http://localhost:3001 | Auth Service |
| http://localhost:3002 | Incident Service |
| http://localhost:3003 | Dispatch Service |
| http://localhost:3004 | Analytics Service |
| http://localhost:15672 | RabbitMQ Management UI (guest/guest) |

---

## Development Workflow

- Each service has its own `package.json` — run `npm install` inside each service folder
- Use `docker compose up --build <service-name>` to rebuild a single service
- Logs: `docker compose logs -f <service-name>`

---

## Branch Strategy

```
main          ← stable, working code only
dev           ← integration branch, merge here first
feature/...   ← your working branches (e.g. feature/auth-login)
```

Never push directly to `main`. Always open a PR into `dev` first.
