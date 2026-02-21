# 🌙 Iftar Tracker 2026

**Worldwide Iftar & Biryani Tracker** — Find iftar information at mosques around the world, powered by AI.

> A fully dynamic, mobile-responsive web application with AI chatbot, Google Maps integration, location-based filtering, and real-time prayer time countdown.

---

## ✨ Features

| Feature                        | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| 🤖 **AI Chatbot**              | Ask questions about mosques, iftar menus, biryani, prayer times — powered by Groq AI |
| 📍 **Auto Location Detection** | Automatically detects your country/city using browser geolocation                    |
| 🗺️ **Google Maps Integration** | View any mosque location directly on Google Maps                                     |
| 🔍 **Smart Search & Filters**  | Search by name, area, city, country. Filter by biryani availability, nearby mosques  |
| ⏰ **Live Prayer Countdown**   | Real-time countdown to next Sehri/Iftar based on your location                       |
| 🕌 **Add Mosques Dynamically** | Users can submit new mosques — no hardcoded data, everything is community-driven     |
| 💬 **Comment System**          | Leave reviews and updates on mosque iftar quality                                    |
| 📱 **Fully Mobile Responsive** | Premium dark Islamic theme, glassmorphism UI, works on all devices                   |

---

## 🛠️ Tech Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| **Frontend**     | HTML5, Vanilla CSS, Vanilla JavaScript        |
| **Backend**      | Python FastAPI (Vercel Serverless Functions)  |
| **Database**     | PostgreSQL (Neon — free tier)                 |
| **AI**           | Groq API (`llama-3.3-70b-versatile`)          |
| **Prayer Times** | Aladhan API (free, no key needed)             |
| **Geocoding**    | OpenStreetMap Nominatim (free, no key needed) |
| **Hosting**      | Vercel (free tier — frontend + backend)       |

---

## 📁 Project Structure

```
iftar/
├── api/
│   └── index.py            # FastAPI backend (all API routes)
│
├── index.html              # Main frontend page
├── style.css               # Premium dark Islamic theme CSS
├── app.js                  # Frontend logic (chatbot, maps, filters)
├── favicon.svg             # Crescent moon favicon
│
├── requirements.txt        # Python dependencies
├── vercel.json             # Vercel deployment config
└── README.md               # This file
```

---

## 🔌 API Endpoints

| Method | Endpoint                       | Description                                                                      |
| ------ | ------------------------------ | -------------------------------------------------------------------------------- |
| `GET`  | `/api/mosques`                 | List mosques (with optional filters: `country`, `city`, `search`, `has_biryani`) |
| `POST` | `/api/mosques`                 | Add a new mosque                                                                 |
| `POST` | `/api/mosques/{id}/comments`   | Add a comment to a mosque                                                        |
| `GET`  | `/api/prayer-times?lat=&lng=`  | Get prayer times for a location                                                  |
| `GET`  | `/api/location-info?lat=&lng=` | Reverse geocode coordinates to country/city                                      |
| `GET`  | `/api/countries`               | List all countries with mosque counts                                            |
| `GET`  | `/api/cities?country=`         | List cities (optionally filtered by country)                                     |
| `POST` | `/api/chat`                    | AI chatbot — send a message, get a Groq-powered response                         |

---

## 🚀 Setup & Deployment

### Prerequisites

- Python 3.9+
- Node.js (for Vercel CLI)
- A Neon PostgreSQL database (free tier)
- Groq API key (get one at https://console.groq.com)

### 1. Get a Free Neon PostgreSQL Database

1. Go to https://neon.tech and sign up (free)
2. Create a new project
3. Copy your connection string (format: `postgresql://user:pass@host/dbname`)

### 2. Set Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

> ⚠️ **Never commit real credentials to Git.** Use the Vercel dashboard or a `.env` file (added to `.gitignore`) for local development.

#### Required Variables

```env
# Neon PostgreSQL (pooled — recommended)
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xxxxx-pooler.region.neon.tech/neondb?sslmode=require

# Groq AI API Key
GROQ_API_KEY=gsk_your_groq_api_key_here
```

#### Optional Neon Variables (if needed)

```env
# Unpooled connection (for migrations or long-running queries)
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:your_password@ep-xxxxx.region.neon.tech/neondb?sslmode=require

# Individual connection parameters
PGHOST=ep-xxxxx-pooler.region.neon.tech
PGUSER=neondb_owner
PGDATABASE=neondb
PGPASSWORD=your_password
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run Locally

```bash
# Set env vars locally
# Create a .env file with DATABASE_URL and GROQ_API_KEY

# Start the FastAPI server
uvicorn api.index:app --reload --port 8000

# Open http://localhost:8000 in your browser
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel Dashboard → Settings → Environment Variables.

---

## 📋 Development Tasks

- [x] Project plan & README
- [ ] Create `vercel.json` with routing config
- [ ] Build backend API (`api/index.py`)
  - [ ] Database models (Mosque, Comment) with Neon PostgreSQL
  - [ ] CRUD endpoints for mosques
  - [ ] Comment system
  - [ ] AI chatbot endpoint (Groq API)
  - [ ] Prayer times proxy
  - [ ] Reverse geocoding
  - [ ] Country/city listing
- [ ] Build frontend
  - [ ] Hero section with prayer countdown timer
  - [ ] Location auto-detection & badge
  - [ ] Search bar & filter controls
  - [ ] Mosque cards grid (dynamic, no default data)
  - [ ] Add mosque form with geolocation
  - [ ] Comment submission on each card
  - [ ] AI chatbot floating widget
  - [ ] Google Maps links on cards
  - [ ] Toast notifications
  - [ ] Mobile responsive (320px → 1920px+)
- [ ] CSS Design System
  - [ ] Dark Islamic theme (navy + gold + emerald)
  - [ ] Glassmorphism cards
  - [ ] Smooth animations & micro-interactions
  - [ ] Mobile-first responsive breakpoints
- [ ] Testing & verification
- [ ] Deploy to Vercel

---

## 📝 License

MIT — Free to use and modify.
