# Sentiment-Driven Service Recovery Agent 🏥

An AI-powered full-stack hospital patient feedback system with real-time sentiment analysis, complaint management, and manager alerting.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TailwindCSS, Recharts, WebSocket |
| Backend | Python FastAPI, WebSockets |
| AI | Google Gemini 1.5 Flash |
| Database | MongoDB (Motor async driver) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally on port 27017
- A Google Gemini API key

### 1. Configure Environment

```bash
# Backend
cp .env.example backend/.env
# Edit backend/.env and set GOOGLE_API_KEY=your_key_here
```

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py        # Seed demo data (run once)
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
API docs: http://localhost:8000/docs

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Features

### Core Workflow
1. Patient discharged → survey triggered automatically
2. Patient submits feedback
3. Gemini AI analyzes: **sentiment + emotion + category + severity + resolution**
4. Negative → complaint ticket created + manager alerted in real time
5. Positive → Google review request logged
6. Dashboard updates instantly via WebSocket

### Pages
| Page | URL | Description |
|---|---|---|
| Dashboard | `/dashboard` | Stat cards, charts, live activity feed |
| Feedback Monitor | `/feedback` | Submit & view feedback with AI analysis |
| Complaint Tickets | `/tickets` | Manage and resolve tickets |
| Dept Heatmap | `/heatmap` | Risk intensity by department |
| Analytics | `/analytics` | Weekly trends & category breakdown |
| Notifications | `/notifications` | Manager critical alerts panel |

### AI (Gemini 1.5 Flash)
- Sentiment: Positive / Negative / Neutral
- Emotion detection (Angry / Frustrated / Satisfied / etc.)
- Complaint category extraction
- Severity score (1–5)
- Personalized resolution message

### Real-Time Events (WebSocket)
- `new_feedback` – feedback received
- `new_ticket` – complaint ticket created
- `ticket_resolved` – ticket marked resolved
- `manager_alert` – critical complaint (severity ≥ 4)
- `escalation` – repeated complaints (3+ same dept per week)

---

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── db/mongodb.py        # MongoDB (Motor) connection
│   ├── models/schemas.py    # Pydantic models
│   ├── routes/              # API routes
│   │   ├── feedback.py
│   │   ├── tickets.py
│   │   ├── patients.py
│   │   ├── dashboard.py
│   │   ├── reports.py
│   │   ├── departments.py
│   │   └── managers.py
│   ├── services/
│   │   ├── gemini_service.py  # Gemini AI
│   │   ├── ticket_service.py  # Ticket + escalation logic
│   │   └── ws_manager.py      # WebSocket broadcast
│   ├── seed.py               # Demo data seeder
│   └── requirements.txt
├── frontend/
│   ├── app/                  # Next.js App Router pages
│   │   ├── dashboard/
│   │   ├── feedback/
│   │   ├── tickets/
│   │   ├── heatmap/
│   │   ├── analytics/
│   │   └── notifications/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── WSProvider.tsx
│   └── lib/
│       ├── api.ts
│       ├── websocket.ts
│       └── utils.ts
└── .env.example
```
