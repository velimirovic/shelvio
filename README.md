# Shelvio

Mikroservisna platforma za praćenje multimedijalnih sadržaja i personalizovane preporuke zasnovane na veštačkoj inteligenciji.
Diplomski rad — Marko Velimirović, Fakultet tehničkih nauka, Novi Sad.

## Arhitektura

| Komponenta | Tehnologija | Port (interno) | Odgovornost |
|---|---|---|---|
| API Gateway | ASP.NET Core 9 + YARP | 8080 (javno: `localhost:8080`) | Rutiranje, centralna JWT validacija, CORS |
| User Service | ASP.NET Core 9 + EF Core | 8080 | Registracija, login, JWT access/refresh tokeni |
| Tracking Service | ASP.NET Core 9 + EF Core | 8080 | Liste praćenja, ocene, statusi, lična statistika |
| Content Service | Node.js 20 + Express | 3000 | TMDB (filmovi/serije) i Hardcover (knjige) integracija, pretraga, Redis keš |
| Recommendation Service | Python 3.12 + FastAPI | 8000 | AI preporuke (pgvector + GPT re-ranking) — **još nije implementiran, samo skeleton** |
| PostgreSQL ×3 | postgres:16 / pgvector:pg16 | 5432 (host: 5532/5533/5534) | Po jedna baza po servisu |
| Redis | redis:7 | 6379 | Keš eksternih API odgovora i preporuka |
| RabbitMQ | rabbitmq:3.13 | 5672 (management UI: 15672) | Asinhroni eventi ka Recommendation servisu |
| Frontend | Angular 21 | 80 (host: `localhost:4200`) | SPA, komunicira isključivo kroz API Gateway |

Frontend → API Gateway → interni servisi; servisi su na internoj Docker mreži.

## Pokretanje

Jedini preduslov je **Docker Desktop**.

1. Kopirati `.env.example` u `.env` i popuniti vrednosti (Postgres/RabbitMQ lozinke, JWT
   secret — `openssl rand -base64 64`, TMDB API ključ, Hardcover token; OpenAI ključ tek za
   Recommendation servis).
2. ```
   docker compose up -d --build
   ```
3. Aplikacija: **http://localhost:4200** (API Gateway: http://localhost:8080).

EF Core migracije se primenjuju automatski na startu — prazna baza se sama inicijalizuje.

Health provere: gateway `GET :8080/health`; interni servisi imaju sopstveni `/health`
(user, tracking, content, recommendation) dostupan unutar Docker mreže.

## Testovi

| Servis | Pokretanje | Pokriva |
|---|---|---|
| Tracking Service | `cd services/tracking-service && dotnet test` | Statistika (GetStats), add-or-update logika, user scoping |
| User Service | `cd services/user-service && dotnet test` | Auth tokovi: register/login/refresh rotacija/logout, BCrypt |
| Content Service | `cd services/content-service && npx jest` | Algoritam rangiranja pretrage (rankingService) |

## Struktura repozitorijuma

```
services/
  api-gateway/            YARP reverse proxy + JWT validacija
  user-service/           src/UserService.API + tests/UserService.Tests
  tracking-service/       src/TrackingService.API + tests/TrackingService.Tests
  content-service/        Express app (src/), jest testovi uz kod
  recommendation-service/ FastAPI skeleton (Faza 6 — u planu)
frontend/                 Angular SPA
docker-compose.yml        Ceo sistem jednom komandom
```
