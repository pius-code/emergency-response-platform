# Emergency Response & Dispatch Coordination Platform
**Backend — Phase 2**

> CPEN 421: Mobile and Web Software Design and Architecture
> University of Ghana, School of Engineering Sciences — Group 26

A microservices-based backend for coordinating emergency services across Ghana.
Four independent services communicate via REST APIs, RabbitMQ message queues, and WebSockets.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [How to Run](#3-how-to-run)
4. [Environment Variables](#4-environment-variables)
5. [Service 1 — Auth Service (port 3001)](#5-service-1--auth-service-port-3001)
6. [Service 2 — Incident Service (port 3002)](#6-service-2--incident-service-port-3002)
7. [Service 3 — Dispatch Service (port 3003)](#7-service-3--dispatch-service-port-3003)
8. [Service 4 — Analytics Service (port 3004)](#8-service-4--analytics-service-port-3004)
9. [How Auto-Dispatch Works](#9-how-auto-dispatch-works)
10. [How RabbitMQ Messaging Works](#10-how-rabbitmq-messaging-works)
11. [How Real-Time Tracking Works](#11-how-real-time-tracking-works)
12. [Database Schemas](#12-database-schemas)
13. [Authentication and JWT](#13-authentication-and-jwt)
14. [Development Workflow](#14-development-workflow)
15. [API Documentation (Swagger)](#15-api-documentation-swagger)

---

## 1. System Overview

When a citizen reports an emergency:

```
Citizen calls hotline
      ↓
System admin logs into the dashboard
      ↓
Admin fills incident form (type, location, citizen details)
      ↓
Backend finds the nearest available vehicle (Haversine distance)
      ↓
Dispatches that vehicle and tracks its GPS in real time
      ↓
All services stay in sync via RabbitMQ events
      ↓
Admin marks incident resolved → vehicle becomes available again
```

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND                        │
│              React App (port 8080)                  │
└────────┬──────────────┬────────────────┬────────────┘
         │              │                │
         ▼              ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Auth Service │ │  Incident    │ │  Dispatch    │
│  port 3001   │ │  Service     │ │  Service     │
│              │ │  port 3002   │ │  port 3003   │
│  PostgreSQL  │ │              │ │              │
│  (users_db)  │ │  PostgreSQL  │ │  PostgreSQL  │
└──────────────┘ │(incidents_db)│ │(vehicles_db) │
                 └──────┬───────┘ └──────┬───────┘
                        │                │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │   RabbitMQ     │
                        │ Message Broker │
                        │  port 5672     │
                        └───────┬────────┘
                                │
                        ┌───────▼────────┐
                        │  Analytics     │
                        │  Service       │
                        │  port 3004     │
                        │  PostgreSQL    │
                        │(analytics_db)  │
                        └────────────────┘
```

**Inter-service communication:**
- **Incident → Dispatch:** HTTP call (axios) to find nearest available vehicle
- **Incident → RabbitMQ:** publishes events when incidents are created or resolved
- **Dispatch → RabbitMQ:** publishes GPS location update events
- **Dispatch ← RabbitMQ:** subscribes to incident events to update vehicle status
- **Analytics ← RabbitMQ:** subscribes to all events to record metrics
- **Dispatch → Socket.io:** broadcasts live GPS updates to all connected browser clients

---

## 3. How to Run

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required to run all services
- [Node.js v18+](https://nodejs.org/) — needed for local development without Docker
- [Git](https://git-scm.com/)

### Run everything with Docker (recommended)

```bash
# 1. Go into the backend folder
cd responder-hub/emergency-response-platform

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Build and start all 8 containers (4 services + RabbitMQ + PostgreSQL + MongoDB + Redis)
docker compose up --build

# 4. Check all containers are running
docker compose ps
```

### Useful URLs once running

| URL | What it is |
|---|---|
| http://localhost:3001 | Auth Service |
| http://localhost:3001/health | Auth Service health check |
| http://localhost:3001/api-docs | Auth Service — Swagger UI |
| http://localhost:3002 | Incident Service |
| http://localhost:3002/api-docs | Incident Service — Swagger UI |
| http://localhost:3003 | Dispatch Service |
| http://localhost:3003/api-docs | Dispatch Service — Swagger UI |
| http://localhost:3004 | Analytics Service |
| http://localhost:3004/api-docs | Analytics Service — Swagger UI |
| http://localhost:15672 | RabbitMQ Management UI (login: guest / guest) |

### Run a single service (development)

```bash
# Go into the service folder
cd services/auth-service

# Install dependencies
npm install

# Start with hot-reload
npm run dev
```

Make sure PostgreSQL and RabbitMQ are running first (via Docker).

### Useful Docker commands

```bash
# Stop all containers
docker compose down

# Rebuild one service after code changes
docker compose up --build auth-service

# View live logs for one service
docker compose logs -f incident-service

# View logs for all services
docker compose logs -f
```

---

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# JWT — must be a long random string, minimum 32 characters
JWT_SECRET=change_this_to_a_long_random_string_min_32_chars
JWT_EXPIRES_IN=3600           # access token lifetime in seconds (1 hour)
JWT_REFRESH_EXPIRES_IN=604800 # refresh token lifetime in seconds (7 days)

# Internal service URLs (used when services call each other)
AUTH_SERVICE_URL=http://auth-service:3001
INCIDENT_SERVICE_URL=http://incident-service:3002
DISPATCH_SERVICE_URL=http://dispatch-service:3003
ANALYTICS_SERVICE_URL=http://analytics-service:3004

# RabbitMQ
RABBITMQ_URL=amqp://rabbitmq:5672

# PostgreSQL — shared across all services
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
AUTH_DB_NAME=users_db
INCIDENT_DB_NAME=incidents_db
ANALYTICS_DB_NAME=analytics_db

# MongoDB (configured but not actively used in current version)
MONGO_URI=mongodb://mongo:27017/vehicles_db

# Redis (configured but not actively used in current version)
REDIS_URL=redis://redis:6379
```

> When running **without Docker** (local dev), change `auth-service`, `rabbitmq`, etc. to `localhost` in the URLs above.

---

## 5. Service 1 — Auth Service (port 3001)

**Purpose:** Manages all users, handles login, issues JWT tokens, and manages station records.

**Database:** PostgreSQL — `users_db`
**Framework:** Express.js
**Entry point:** `services/auth-service/src/app.js`

### File Structure

```
auth-service/
└── src/
    ├── app.js                  ← Express setup, mounts routes, starts server
    ├── config/
    │   └── db.js               ← Connects to PostgreSQL via Sequelize
    ├── controllers/
    │   ├── auth.controller.js  ← register, login, refreshToken, getProfile,
    │   │                         getAllUsers, editUser, updateRole
    │   └── station.controller.js ← createStation, getStations, updateCapacity
    ├── middleware/
    │   └── auth.middleware.js  ← verifyToken, requireRole
    ├── models/
    │   ├── user.model.js       ← User table definition
    │   └── station.model.js    ← Station table definition
    └── routes/
        └── auth.routes.js      ← All route definitions for this service
```

### API Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|---|---|---|---|---|
| POST | `/auth/login` | No | — | Log in with email + password. Returns access token, refresh token, and user object. |
| POST | `/auth/refresh-token` | No | — | Exchange a refresh token for a new access token. |
| GET | `/auth/profile` | Yes | Any | Return the currently logged-in user's profile. |
| POST | `/auth/register` | Yes | All admins | Create a new user account. Hospital/police/fire admins are limited to their own domain. |
| GET | `/auth/users` | Yes | system_admin, hospital_admin | List all users. hospital_admin only sees users in their own station. |
| PUT | `/auth/users/:id` | Yes | All admins | Edit user name, email, or station_id. Station-scoped for non-system admins. |
| PUT | `/auth/users/:id/role` | Yes | system_admin | Change a user's role. |
| POST | `/auth/stations` | Yes | All admins | Create a new station. Hospitals require capacity fields. |
| GET | `/auth/stations` | Yes | All admins | List stations. Filtered by type based on caller role. Includes assigned users. |
| PUT | `/auth/stations/:id/capacity` | Yes | system_admin, hospital_admin | Update bed capacity for a hospital station. |
| GET | `/health` | No | — | Returns service status and timestamp. |

### Request and Response Examples

**POST /auth/login**
```json
// Request body
{
  "email": "admin@ercp.gh",
  "password": "Admin1234!"
}

// Response 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "userId": "a1b2c3d4-...",
    "name": "Kofi Mensah",
    "email": "admin@ercp.gh",
    "role": "system_admin"
  }
}
```

**POST /auth/register**
```json
// Request body
{
  "name": "Ama Owusu",
  "email": "ama@korlebu.gh",
  "password": "Secure1234!",
  "role": "hospital_admin",
  "station_id": "HOSP-001"
}

// Response 201
{
  "userId": "b2c3d4e5-...",
  "name": "Ama Owusu",
  "email": "ama@korlebu.gh",
  "role": "hospital_admin",
  "station_id": "HOSP-001",
  "createdAt": "2026-03-27T10:00:00.000Z"
}
```

**POST /auth/stations**
```json
// Request body
{
  "station_id": "HOSP-001",
  "name": "Korle Bu Teaching Hospital",
  "type": "hospital",
  "address": "Korle Bu, Accra",
  "latitude": 5.5467,
  "longitude": -0.2317,
  "total_capacity": 200
}
```

**PUT /auth/stations/:id/capacity**
```json
// Request body
{
  "total_capacity": 200,
  "available_capacity": 45
}

// Response 200
{
  "message": "Capacity updated",
  "station_id": "HOSP-001",
  "total_capacity": 200,
  "available_capacity": 45
}
```

---

## 6. Service 2 — Incident Service (port 3002)

**Purpose:** Records emergency incidents, automatically dispatches the nearest available unit, and tracks incident status through its lifecycle.

**Database:** PostgreSQL — `incidents_db`
**Framework:** Express.js
**Entry point:** `services/incident-service/src/app.js`

### File Structure

```
incident-service/
└── src/
    ├── app.js                      ← Express setup, connects RabbitMQ on start
    ├── config/
    │   ├── db.js                   ← PostgreSQL connection via Sequelize
    │   └── queue.js                ← RabbitMQ connection + publishEvent() helper
    ├── controllers/
    │   └── incident.controller.js  ← createIncident, getAllIncidents,
    │                                 getOpenIncidents, getIncidentById,
    │                                 updateStatus, assignUnit
    ├── middleware/
    │   └── auth.middleware.js      ← verifyToken, requireRole
    ├── models/
    │   └── incident.model.js       ← Incident table definition
    └── routes/
        └── incident.routes.js      ← All route definitions
```

### API Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|---|---|---|---|---|
| POST | `/incidents` | Yes | system_admin | Create a new incident. Automatically dispatches nearest available unit. |
| GET | `/incidents` | Yes | All roles | List all incidents. Results filtered by incident types relevant to caller's role. Supports `?status=` and `?incident_type=` query params. |
| GET | `/incidents/open` | Yes | All roles | List only non-resolved incidents. Same role filtering applies. |
| GET | `/incidents/:id` | Yes | All roles | Get full details of one incident by its ID. |
| PUT | `/incidents/:id/status` | Yes | All admins | Update the status of an incident (created → dispatched → in_progress → resolved). Publishes `incident.resolved` event when status is set to resolved. |
| PUT | `/incidents/:id/assign` | Yes | system_admin | Manually assign a specific unit to an incident. |
| GET | `/health` | No | — | Returns service status. |

### Incident Type → Responder Type Mapping

| Incident Types | Dispatched To | Vehicle Type |
|---|---|---|
| fire, explosion, gas leak | Fire service | fire_truck |
| medical emergency, accident, injury | Hospital ambulance | ambulance |
| everything else (crime, robbery, etc.) | Police station | police_car |

### Role → Visible Incident Types

| Role | Incident Types Shown |
|---|---|
| system_admin | All types |
| police_admin | crime |
| fire_admin | fire |
| hospital_admin | medical emergency, accident |
| ambulance_driver | medical emergency, accident |

### Request and Response Examples

**POST /incidents**
```json
// Request body
{
  "citizen_name": "Kwame Asante",
  "citizen_phone": "+233241234567",
  "incident_type": "medical emergency",
  "latitude": 5.6037,
  "longitude": -0.1870,
  "notes": "Unconscious, possible cardiac arrest"
}

// Response 201 — unit found and dispatched
{
  "incidentId": "INC-2026-4821",
  "status": "dispatched",
  "assignedUnit": {
    "type": "ambulance",
    "id": "AMB-KBT-01",
    "name": "HOSP-001",
    "distanceKm": "2.34"
  },
  "dispatchedAt": "2026-03-27T10:15:32.000Z"
}

// Response 201 — no unit available
{
  "incidentId": "INC-2026-4822",
  "status": "created",
  "message": "Incident logged. No available unit found at this time."
}
```

**PUT /incidents/:id/status**
```json
// Request body
{ "status": "in_progress" }

// Response 200
{
  "message": "Status updated",
  "incidentId": "INC-2026-4821",
  "status": "in_progress"
}
```

---

## 7. Service 3 — Dispatch Service (port 3003)

**Purpose:** Manages the vehicle fleet, receives GPS location updates, broadcasts real-time position via WebSocket, and listens for incident events to update vehicle status.

**Database:** PostgreSQL — `vehicles_db`
**Framework:** Express.js + Socket.io
**Entry point:** `services/dispatch-service/src/app.js`

### File Structure

```
dispatch-service/
└── src/
    ├── app.js                      ← Express + Socket.io setup. Subscribes to RabbitMQ
    │                                 events on startup.
    ├── config/
    │   ├── db.js                   ← PostgreSQL connection via Sequelize
    │   └── queue.js                ← RabbitMQ connection + event subscribers
    ├── controllers/
    │   └── vehicle.controller.js   ← registerVehicle, getAllVehicles, getVehicleById,
    │                                 getVehicleLocation, updateLocation,
    │                                 updateVehicleStatus, getLocationHistory, trackIncident
    ├── middleware/
    │   └── auth.middleware.js      ← verifyToken, requireRole
    ├── models/
    │   ├── vehicle.model.js        ← Vehicle table definition
    │   └── location.model.js       ← LocationHistory table definition
    └── routes/
        └── vehicle.routes.js       ← All route definitions
```

### API Endpoints

| Method | Endpoint | Auth Required | Role Required | Description |
|---|---|---|---|---|
| POST | `/vehicles/register` | Yes | All admins | Register a new vehicle with station, type, and optional initial GPS coordinates. |
| GET | `/vehicles` | Yes | Any | List all vehicles. Supports `?status=available` and `?type=ambulance` query params. Used by incident-service to find nearest available unit. |
| GET | `/vehicles/:id` | Yes | Any | Get full details of one vehicle. |
| GET | `/vehicles/:id/location` | Yes | Any | Get the current GPS position of a vehicle (lat, lng, speed, status, last_updated). |
| POST | `/vehicles/:id/location` | Yes | Any | Submit a new GPS location for a vehicle. Saves to location history, publishes RabbitMQ event, and broadcasts via WebSocket. |
| PUT | `/vehicles/:id/status` | Yes | All admins | Manually update a vehicle's status (available, dispatched, en_route, on_scene, returning). |
| GET | `/vehicles/:id/history` | Yes | Any | Get the full GPS history of a vehicle (last 100 records, newest first). |
| GET | `/dispatch/:incidentId/track` | Yes | Any | Get the vehicle assigned to an incident and its full location history. |
| GET | `/health` | No | — | Returns service status. |

### Vehicle Status Lifecycle

```
available
    ↓ (incident dispatched)
dispatched
    ↓ (driver updates status)
en_route → on_scene → returning
    ↓ (incident resolved via RabbitMQ event)
available
```

### WebSocket Events

Clients connect to `http://localhost:3003` using socket.io-client.

**Emitted by server → client:**
| Event | When | Payload |
|---|---|---|
| `location_update` | Every time any vehicle submits a GPS update | `{ vehicleId, incidentId, latitude, longitude, speed_kmh, timestamp }` |

**Received from client → server:**
| Event | Purpose | Payload |
|---|---|---|
| `subscribe` | Subscribe to updates for a specific vehicle | `{ vehicleId: "AMB-KBT-01" }` |

### Request and Response Examples

**POST /vehicles/register**
```json
// Request body
{
  "vehicle_id": "AMB-KBT-01",
  "station_id": "HOSP-001",
  "vehicle_type": "ambulance",
  "latitude": 5.5467,
  "longitude": -0.2317
}

// Response 201
{
  "vehicle_id": "AMB-KBT-01",
  "station_id": "HOSP-001",
  "vehicle_type": "ambulance",
  "status": "available",
  "latitude": "5.5467000",
  "longitude": "-0.2317000",
  "speed_kmh": null,
  "incident_id": null,
  "created_at": "2026-03-27T10:00:00.000Z"
}
```

**POST /vehicles/:id/location**
```json
// Request body
{
  "latitude": 5.5512,
  "longitude": -0.2190,
  "speed_kmh": 65.5
}

// Response 200
{
  "message": "Location updated",
  "vehicleId": "AMB-KBT-01",
  "latitude": 5.5512,
  "longitude": -0.2190
}
```

**GET /dispatch/:incidentId/track**
```json
// Response 200
{
  "vehicle": {
    "vehicle_id": "AMB-KBT-01",
    "status": "on_scene",
    "latitude": "5.6037000",
    "longitude": "-0.1870000"
  },
  "locationHistory": [
    { "latitude": "5.5467", "longitude": "-0.2317", "speed_kmh": "0", "recorded_at": "..." },
    { "latitude": "5.5512", "longitude": "-0.2190", "speed_kmh": "65.5", "recorded_at": "..." }
  ]
}
```

---

## 8. Service 4 — Analytics Service (port 3004)

**Purpose:** Listens to all RabbitMQ events and stores them. Provides aggregated statistics on demand.

**Database:** PostgreSQL — `analytics_db`
**Framework:** Express.js
**Entry point:** `services/analytics-service/src/app.js`

### File Structure

```
analytics-service/
└── src/
    ├── app.js                        ← Express setup + subscribes to 4 RabbitMQ events
    ├── config/
    │   ├── db.js                     ← PostgreSQL connection
    │   └── queue.js                  ← RabbitMQ subscriber
    ├── controllers/
    │   └── analytics.controller.js   ← getResponseTimes, getIncidentsByRegion,
    │                                   getResourceUtilization, getIncidentsSummary
    ├── middleware/
    │   └── auth.middleware.js        ← verifyToken
    ├── models/
    │   └── analytics.model.js        ← AnalyticsEvent table definition
    └── routes/
        └── analytics.routes.js       ← All route definitions
```

### API Endpoints

All endpoints support optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` query params to filter by date range (defaults to last 30 days).

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/analytics/response-times` | Yes | Average response time in minutes. Supports `?incidentType=` and `?serviceType=` filters. Returns overall average and breakdown per incident type. |
| GET | `/analytics/incidents-by-region` | Yes | Count of incidents grouped by type. Supports `?incidentType=` filter. |
| GET | `/analytics/resource-utilization` | Yes | Totals for incidents created, dispatched, resolved. Resolution rate %. Breakdown by service type. |
| GET | `/analytics/incidents/summary` | Yes | Quick summary: total, dispatched, resolved, pending counts. |
| GET | `/health` | No | Returns service status. |

### Response Examples

**GET /analytics/response-times**
```json
{
  "averageResponseTimeMinutes": 8.45,
  "totalResolved": 24,
  "breakdown": [
    { "incidentType": "medical emergency", "avgMinutes": "6.20", "count": 10 },
    { "incidentType": "fire",              "avgMinutes": "9.80", "count": 7  },
    { "incidentType": "crime",             "avgMinutes": "10.30","count": 7  }
  ],
  "period": { "from": "2026-02-27", "to": "2026-03-27" }
}
```

**GET /analytics/resource-utilization**
```json
{
  "totalIncidentsCreated": 30,
  "totalDispatched": 28,
  "totalResolved": 24,
  "resolutionRate": "80.0%",
  "byServiceType": {
    "ambulance": 10,
    "police":    12,
    "fire":       6
  },
  "period": { "from": "2026-02-27", "to": "2026-03-27" }
}
```

**GET /analytics/incidents/summary**
```json
{
  "total": 30,
  "dispatched": 28,
  "resolved": 24,
  "pending": 6,
  "period": { "from": "2026-02-27", "to": "2026-03-27" }
}
```

---

## 9. How Auto-Dispatch Works

When `POST /incidents` is called, the incident service runs this logic:

```
Step 1 — Determine responder type from incident_type:
  "fire" / "explosion" / "gas leak"              → fire   → fire_truck
  "medical emergency" / "accident" / "injury"    → ambulance → ambulance
  anything else (crime, robbery, assault, etc.)  → police  → police_car

Step 2 — Ask dispatch service for available vehicles of that type:
  GET http://dispatch-service:3003/vehicles?status=available&type=fire_truck
  (using a short-lived service-to-service JWT token, expires in 1 minute)

Step 3 — Calculate Haversine distance from incident to each vehicle:
  Uses: lat1, lon1 (incident), lat2, lon2 (vehicle)
  Returns distance in kilometres

Step 4 — Sort vehicles by distance, take the closest one

Step 5 — Save the assignment to the database:
  incident.assigned_unit_id = vehicle.vehicle_id
  incident.status           = "dispatched"
  incident.dispatched_at    = now

Step 6 — Publish two RabbitMQ events:
  "incident.created"  → dispatch service marks vehicle as "dispatched"
  "unit.dispatched"   → analytics service records the dispatch event

Step 7 — Return to caller:
  { incidentId, status: "dispatched", assignedUnit: { type, id, name, distanceKm } }
```

If no available vehicle is found, the incident is saved with `status: "created"` and the caller is told no unit was found.

**Haversine formula used:**
```js
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
```

---

## 10. How RabbitMQ Messaging Works

All services connect to the same RabbitMQ instance. Events are published and consumed through a single **topic exchange** called `emergency.events`.

**Think of it like a broadcast system:**
- A service publishes a message with a routing key (e.g. `incident.created`)
- Any service that has subscribed to that routing key receives a copy of the message
- If a subscriber is offline, messages are queued until it comes back

### Event Reference

| Routing Key | Published By | Consumed By | Payload |
|---|---|---|---|
| `incident.created` | incident-service | dispatch-service, analytics-service | `{ incidentId, incidentType, latitude, longitude, assignedUnitId, assignedUnitType, createdBy }` |
| `unit.dispatched` | incident-service | analytics-service | `{ incidentId, unitId, unitType, dispatchedAt }` |
| `incident.resolved` | incident-service | dispatch-service, analytics-service | `{ incidentId, resolvedBy, resolvedAt, responseTimeSeconds }` |
| `location.updated` | dispatch-service | analytics-service | `{ vehicleId, incidentId, latitude, longitude, speedKmh }` |

### What each subscriber does with the events

**dispatch-service receives `incident.created`:**
→ Finds the vehicle matching `assignedUnitId` and sets its status to `"dispatched"`

**dispatch-service receives `incident.resolved`:**
→ Finds the vehicle that had that `incidentId` and sets its status back to `"available"`

**analytics-service receives all 4 events:**
→ Saves a record to the `analytics_events` table for later aggregation

---

## 11. How Real-Time Tracking Works

The dispatch service runs a **Socket.io** server on the same port (3003) alongside Express.

```
Vehicle (driver's phone / GPS device)
  sends: POST /vehicles/:id/location  { latitude, longitude, speed_kmh }
    ↓
dispatch-service saves to vehicle table
    ↓
dispatch-service saves to location_history table
    ↓
dispatch-service publishes "location.updated" event to RabbitMQ
    ↓
dispatch-service emits "location_update" via Socket.io to ALL connected clients
    ↓
Dashboard browser receives the event and updates the map marker position
```

**Connecting from the browser (socket.io-client):**
```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3003');

socket.on('location_update', (data) => {
  console.log(data);
  // {
  //   vehicleId: "AMB-KBT-01",
  //   incidentId: "INC-2026-4821",
  //   latitude: 5.5512,
  //   longitude: -0.2190,
  //   speed_kmh: 65.5,
  //   timestamp: "2026-03-27T10:20:00.000Z"
  // }
});

// Subscribe to one specific vehicle's updates
socket.emit('subscribe', { vehicleId: 'AMB-KBT-01' });
```

---

## 12. Database Schemas

### Auth Service — `users_db`

**users table**

| Column | Type | Notes |
|---|---|---|
| user_id | UUID | Primary key, auto-generated |
| name | VARCHAR(120) | Required |
| email | VARCHAR(255) | Required, unique |
| password_hash | VARCHAR(255) | bcrypt hash, never returned in responses |
| role | ENUM | system_admin, hospital_admin, police_admin, fire_admin, ambulance_driver |
| station_id | VARCHAR(50) | Optional. Links user to a station. |
| is_active | BOOLEAN | Default true. Inactive users cannot log in. |
| last_login | TIMESTAMP | Updated on every successful login |
| created_at / updated_at | TIMESTAMP | Auto-managed by Sequelize |

**stations table**

| Column | Type | Notes |
|---|---|---|
| station_id | VARCHAR(50) | Primary key (e.g. "HOSP-001", "POL-ACC-01") |
| name | VARCHAR(120) | Required |
| type | ENUM | hospital, police, fire |
| address | VARCHAR(255) | |
| latitude / longitude | DECIMAL(10,7) | GPS position of the station |
| total_capacity | INTEGER | Hospitals only |
| available_capacity | INTEGER | Hospitals only — updated by hospital admins |
| created_at / updated_at | TIMESTAMP | Auto-managed |

---

### Incident Service — `incidents_db`

**incidents table**

| Column | Type | Notes |
|---|---|---|
| incident_id | VARCHAR(20) | Primary key, format: INC-YYYY-NNNN |
| citizen_name | VARCHAR(120) | Required |
| citizen_phone | VARCHAR(20) | Optional |
| incident_type | VARCHAR(50) | e.g. "fire", "medical emergency", "crime" |
| latitude / longitude | DECIMAL(10,7) | Required — from map location picker |
| notes | TEXT | Optional additional details |
| created_by | UUID | Admin who created the incident |
| assigned_unit_id | VARCHAR(50) | Vehicle ID of dispatched unit |
| assigned_unit_type | ENUM | police, fire, ambulance |
| assigned_hospital | VARCHAR(50) | For medical incidents |
| status | ENUM | created, dispatched, in_progress, resolved |
| dispatched_at | TIMESTAMP | Set when unit is assigned |
| resolved_at | TIMESTAMP | Set when status → resolved |
| created_at / updated_at | TIMESTAMP | Auto-managed |

---

### Dispatch Service — `vehicles_db`

**vehicles table**

| Column | Type | Notes |
|---|---|---|
| vehicle_id | VARCHAR(50) | Primary key (e.g. "AMB-KBT-01") |
| station_id | VARCHAR(50) | Which station this vehicle belongs to |
| vehicle_type | ENUM | ambulance, police_car, fire_truck |
| incident_id | VARCHAR(20) | Current incident (null if available) |
| latitude / longitude | DECIMAL(10,7) | Default: 5.6037, -0.1870 (Accra) |
| speed_kmh | DECIMAL(5,2) | Current speed |
| status | ENUM | available, dispatched, en_route, on_scene, returning |
| last_updated | TIMESTAMP | Updated on every GPS push |
| created_at / updated_at | TIMESTAMP | Auto-managed |

**location_history table**

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| vehicle_id | VARCHAR(50) | Which vehicle |
| incident_id | VARCHAR(20) | Which incident (if any) |
| latitude / longitude | DECIMAL(10,7) | Position at this point in time |
| speed_kmh | DECIMAL(5,2) | Speed at this point |
| recorded_at | TIMESTAMP | When this record was created |

---

### Analytics Service — `analytics_db`

**analytics_events table**

| Column | Type | Notes |
|---|---|---|
| event_id | UUID | Primary key |
| event_type | VARCHAR(50) | incident.created, unit.dispatched, incident.resolved, location.updated |
| incident_id | VARCHAR(20) | Related incident |
| incident_type | VARCHAR(50) | Type of incident (fire, crime, etc.) |
| service_type | VARCHAR(20) | police, fire, ambulance |
| unit_id | VARCHAR(50) | Vehicle or unit ID |
| latitude / longitude | DECIMAL(10,7) | Location at time of event |
| response_time_s | INTEGER | Seconds from creation to resolution (resolved events only) |
| resolved | BOOLEAN | Whether this was a resolution event |
| recorded_at | TIMESTAMP | When the event was received |

---

## 13. Authentication and JWT

All services use the same JWT secret (`JWT_SECRET` in `.env`). This means any service can verify a token issued by the auth service without calling auth-service directly.

**Token payload (what's inside every JWT):**
```json
{
  "userId": "a1b2c3d4-...",
  "email": "admin@ercp.gh",
  "role": "system_admin",
  "iat": 1743069600,
  "exp": 1743073200
}
```

**How to use tokens:**
1. Call `POST /auth/login` → get `accessToken`
2. Add to every request: `Authorization: Bearer <accessToken>`
3. When it expires (1 hour), call `POST /auth/refresh-token` with `{ "refreshToken": "..." }` → get a new `accessToken`

**Role protection on endpoints:**
```
verifyToken    — checks the token is valid and not expired
requireRole    — checks the user's role is in the allowed list

Example: requireRole(['system_admin', 'hospital_admin'])
         → 403 if user is police_admin or fire_admin
```

**Service-to-service calls:**
When incident-service calls dispatch-service to find vehicles, it generates its own short-lived token:
```js
jwt.sign(
  { userId: 'incident-service', email: 'service@internal', role: 'system_admin' },
  process.env.JWT_SECRET,
  { expiresIn: '1m' }
)
```
This expires in 1 minute and is only used for that one request.

---

## 14. Development Workflow

### Branch strategy

```
main          ← stable, working code only. Never commit directly here.
dev           ← integration branch. Merge feature branches here first.
feature/...   ← your working branches (e.g. feature/incident-dispatch)
```

### Adding a new endpoint

1. Add the handler function to the relevant `controllers/` file
2. Add the route in the `routes/` file with the correct middleware
3. Test with Postman or curl
4. Update this README with the new endpoint

### Running tests

```bash
# Inside any service folder:
npm test
```

> Note: automated tests are not yet implemented. Manual testing via Postman is the current approach.

### Checking service health

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

Each returns: `{ "status": "ok", "service": "<name>", "timestamp": "..." }`

---

## 15. API Documentation (Swagger)

Every service serves an interactive Swagger UI at `/api-docs`. Open any of these in your browser after starting the services:

| Service | Swagger UI URL |
|---|---|
| Auth Service | http://localhost:3001/api-docs |
| Incident Service | http://localhost:3002/api-docs |
| Dispatch Service | http://localhost:3003/api-docs |
| Analytics Service | http://localhost:3004/api-docs |

### How it works

Each service has a `src/swagger.yaml` file (OpenAPI 3.0 format) that describes all its endpoints. The service reads that file at startup and serves it as an interactive HTML page via `swagger-ui-express`.

### Installing the Swagger packages

If you are running services individually (not via Docker), run `npm install` inside each service folder to pull in the two new packages added to `package.json`:

```bash
cd services/auth-service && npm install
cd services/incident-service && npm install
cd services/dispatch-service && npm install
cd services/analytics-service && npm install
```

Docker Compose handles this automatically — no extra step needed.

### Authenticating inside Swagger UI

Most endpoints require a Bearer JWT token. To test them without writing curl commands:

1. Call `POST /auth/login` (no auth required) to get a token
2. Copy the `accessToken` from the response
3. Click the **Authorize** button at the top of the Swagger page
4. Paste the token in the `Value` field (just the token, no "Bearer" prefix — Swagger adds it)
5. Click **Authorize** — all subsequent requests in the same session will include the header

Health check endpoints (`/health`) are marked `security: []` in the spec and can be called without a token.

### Spec files location

| Service | Spec file |
|---|---|
| Auth | `services/auth-service/src/swagger.yaml` |
| Incident | `services/incident-service/src/swagger.yaml` |
| Dispatch | `services/dispatch-service/src/swagger.yaml` |
| Analytics | `services/analytics-service/src/swagger.yaml` |
