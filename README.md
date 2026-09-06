# Road-To-Unina

Road-To-Unina (a.k.a. **WikiRace**) is a SPA inspired by the WikiRace game: players start from a Wikipedia page and must reach a target page by following only the links present in the articles, trying to get there in the fewest clicks possible.

Project built for the Web Technologies exam (Università di Napoli Federico II).

**Stack:**
- **Frontend:** Angular (standalone components, signals)
- **Backend:** Spring Boot (Java 21, JPA/Hibernate)
- **Database:** PostgreSQL

## Live version

The app is deployed and publicly accessible at:

**https://wikirace-92g.pages.dev**

Deployment setup:
- **Frontend:** Cloudflare Pages
- **Backend:** Render (free tier)
- **Database:** Neon (PostgreSQL)

> ⚠️ **Note:** the backend runs on Render's free tier, which spins down after a period of inactivity. If the site hasn't been used in a while, the first request after that can take a minute or two while the backend wakes back up. Subsequent requests will be fast again.

## How to run the project locally (Docker)

The easiest way to start the whole project — frontend, backend, and database — without installing Java, Node, or PostgreSQL on your machine is via Docker.

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) installed and running (Docker Desktop on Windows/Mac, or Docker Engine on Linux)

### Setup

1. Clone the repository:

```bash
   git clone <repo-url>
   cd Road-To-Unina
```

2. Create the `.env` file from the template:

```bash
   cp .env.example .env
```

3. Open `.env` and set two values:

   - `DB_PASSWORD`: any password for the local database
   - `JWT_KEY`: a secret string used by the backend to sign authentication tokens. It's not a token you need to obtain from any external service — it's an arbitrary key, it just needs to be long enough (at least 32 characters). You can generate a random one with:

```bash
     openssl rand -base64 48
```

4. Start everything with Docker Compose:

```bash
   docker compose up --build
```

5. Once the containers are up, open your browser at: http://localhost:4200


### What gets started

| Service    | Local port | Description                                             |
|------------|------------|-----------------------------------------------------------|
| `frontend` | 4200       | Angular served by nginx                                   |
| `backend`  | 8080       | Spring Boot API                                            |
| `db`       | 5432       | PostgreSQL, automatically initialized with `schema.sql`    |

The database schema is created automatically on first startup from `schema.sql`: no manual SQL commands are needed. The tables start empty — data gets populated as you use the app (registering users, playing games).

### Stopping the environment

```bash
docker compose down
```

To start fresh from a clean database (also deleting saved data):

```bash
docker compose down -v
```

## Local development (without Docker)

If you prefer to work without containers, check the specific READMEs in `backend/` and `frontend/` for instructions on running Spring Boot and Angular CLI locally.