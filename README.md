# 🌙 Iftar Tracker 2026

**Ramadan Companion App** — Find iftar places, read Quran, track prayer times, explore nearby mosques, and get AI-powered recommendations worldwide.

> A full-featured Progressive Web App with AI chatbot, interactive maps, Quran reader with audio, Ramadan calendar, multi-language support (6 languages), and real-time prayer time countdown.

---

## ✨ Features

### 🏠 Home — Iftar Places

| Feature                        | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| 🤖 **AI Chatbot**              | Ask questions about mosques, iftar menus, biryani, prayer times — powered by Groq AI |
| 🧠 **AI Recommendations**      | Get personalized iftar spot suggestions with clickable Google Maps links             |
| 📍 **Auto Location Detection** | Automatically detects your country/city using browser geolocation                    |
| 🗺️ **Google Maps Integration** | View any place location directly on Google Maps                                      |
| 🔍 **Smart Search & Filters**  | Search by name, area, city, country. Filter by biryani, place type, date             |
| ⏰ **Live Prayer Countdown**   | Real-time countdown to next Sehri/Iftar based on your location                       |
| 🕌 **Add Places Dynamically**  | Users can submit new places with map pin — community-driven                          |
| 💬 **Comment System**          | Leave reviews and updates on iftar quality                                           |
| 🎙️ **Voice Input/Output**     | Speak to AI chatbot and hear responses read aloud                                    |

### 📖 Quran Reader

| Feature                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| 📚 **114 Surahs**              | Browse all surahs with Arabic text and English translation             |
| 🔊 **Audio Recitation**        | Listen to Mishary Alafasy recitation for each surah                    |
| 🔍 **Quran Search**            | Search for any word or phrase across the entire Quran                  |
| 📑 **Juz Navigation**          | Browse Quran by juz (30 parts)                                        |
| 🌐 **Multiple Editions**       | Switch between translation editions                                    |

### 📅 Ramadan Calendar

| Feature                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| 🗓️ **30-Day Timetable**       | Complete Ramadan schedule with Sehri & Iftar times                     |
| 📍 **Location-Based**          | Prayer times calculated for your exact location (Karachi method)       |
| 📊 **Month Selection**         | View calendar for any month of the year                                |

### 🗺️ Nearby Map

| Feature                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| 📍 **Interactive Leaflet Map** | See all iftar places on an interactive map                             |
| 📏 **Radius Selection**        | Filter by distance: 1km, 5km, 10km, 25km, 50km                       |
| 💡 **Rich Tooltips & Popups**  | Hover for quick info, click for full details (menu, location, type)    |
| 🗂️ **Place Cards**            | Browse nearby places in card format below the map                      |

### 🌍 Multi-Language & PWA

| Feature                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| 🌐 **6 Languages**             | English, বাংলা, العربية, اردو, Bahasa Melayu, Türkçe                  |
| ↔️ **RTL Support**             | Full right-to-left layout for Arabic and Urdu                          |
| 📲 **PWA / Installable**       | Install on phone home screen, works offline                            |
| 🔔 **Iftar Reminders**         | Browser notifications before Sehri & Iftar times                       |
| 📱 **Mobile Bottom Nav**       | Facebook-style tab bar on mobile (Home, Quran, Calendar, Nearby)       |

---

## 🛠️ Tech Stack

| Layer             | Technology                                     |
| ----------------- | ---------------------------------------------- |
| **Frontend**      | HTML5, Vanilla CSS, Vanilla JavaScript         |
| **Backend**       | Python 3.13 + FastAPI (Vercel Serverless)      |
| **Database**      | PostgreSQL (Neon — free tier)                  |
| **AI**            | Groq API (`llama-3.3-70b-versatile`)           |
| **Quran API**     | alquran.cloud (surahs, translations, search)   |
| **Quran Audio**   | quranicaudio.com (Mishary Alafasy)             |
| **Prayer Times**  | Aladhan API (Karachi method, free)             |
| **Maps**          | Leaflet.js + OpenStreetMap tiles               |
| **Geocoding**     | OpenStreetMap Nominatim (free)                 |
| **PWA**           | Service Worker + Web App Manifest              |
| **i18n**          | JSON translation files (6 languages)           |
| **Hosting**       | Vercel (free tier — frontend + backend)        |

---

## 📁 Project Structure

```
iftar/
├── api/
│   └── index.py            # FastAPI backend (all API routes)
│
├── i18n/                   # Translation files
│   ├── en.json             # English
│   ├── bn.json             # Bengali (বাংলা)
│   ├── ar.json             # Arabic (العربية)
│   ├── ur.json             # Urdu (اردو)
│   ├── ms.json             # Malay (Bahasa Melayu)
│   └── tr.json             # Turkish (Türkçe)
│
├── index.html              # Main frontend page (tabbed SPA)
├── style.css               # Dark Islamic theme (Navy/Gold/Emerald)
├── app.js                  # Frontend logic (~1600 lines)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (cache v2)
├── favicon.svg             # Crescent moon favicon
│
├── requirements.txt        # Python dependencies
├── vercel.json             # Vercel deployment config
├── .env                    # Environment variables (not committed)
└── README.md               # This file
```

---

## 🔌 API Endpoints

### Places & Comments

| Method | Endpoint                       | Description                                                                      |
| ------ | ------------------------------ | -------------------------------------------------------------------------------- |
| `GET`  | `/api/mosques`                 | List places (filters: `country`, `city`, `search`, `has_biryani`, `place_type`)  |
| `POST` | `/api/mosques`                 | Add a new iftar place                                                            |
| `POST` | `/api/mosques/{id}/comments`   | Add a comment to a place                                                         |

### Location & Prayer

| Method | Endpoint                       | Description                                                                      |
| ------ | ------------------------------ | -------------------------------------------------------------------------------- |
| `GET`  | `/api/prayer-times?lat=&lng=`  | Get prayer times (Karachi method, Sehri = Fajr − 3min)                           |
| `GET`  | `/api/location-info?lat=&lng=` | Reverse geocode coordinates to country/city                                      |
| `GET`  | `/api/countries`               | List all countries with place counts                                             |
| `GET`  | `/api/cities?country=`         | List cities (optionally filtered by country)                                     |
| `GET`  | `/api/ramadan-calendar`        | 30-day Ramadan timetable for a location                                          |

### AI

| Method | Endpoint                       | Description                                                                      |
| ------ | ------------------------------ | -------------------------------------------------------------------------------- |
| `POST` | `/api/chat`                    | AI chatbot — send a message, get a Groq-powered response                         |
| `POST` | `/api/recommend`               | AI iftar spot recommendations based on location & preferences                    |

### Quran (Proxy to alquran.cloud)

| Method | Endpoint                              | Description                                      |
| ------ | ------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/quran/surahs`                   | List all 114 surahs                              |
| `GET`  | `/api/quran/surah/{number}`           | Get a surah's ayahs                              |
| `GET`  | `/api/quran/surah/{number}/editions`  | Get a surah with multiple editions (e.g. Arabic + English) |
| `GET`  | `/api/quran/search`                   | Search Quran text                                |
| `GET`  | `/api/quran/juz/{number}`             | Get ayahs by juz number                          |
| `GET`  | `/api/quran/page/{number}`            | Get ayahs by page number                         |

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

Create a `.env` file in the project root:

> ⚠️ **Never commit real credentials to Git.** Use the Vercel dashboard for production or a `.env` file (added to `.gitignore`) for local development.

```env
# Neon PostgreSQL (pooled — recommended)
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xxxxx-pooler.region.neon.tech/neondb?sslmode=require

# Groq AI API Key
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run Locally

```bash
python -m uvicorn api.index:app --reload --port 8000
# Open http://localhost:8000
```

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in **Vercel Dashboard → Settings → Environment Variables**.

---

## 📋 Completed Features

- [x] Project plan & README
- [x] Vercel deployment config (`vercel.json`)
- [x] FastAPI backend with all endpoints
- [x] PostgreSQL (Neon) — mosques & comments tables
- [x] CRUD for iftar places with map pin picker
- [x] Comment system
- [x] AI chatbot (Groq — llama-3.3-70b-versatile)
- [x] AI iftar recommendations with Google Maps links
- [x] Prayer times with live Sehri/Iftar countdown
- [x] Location auto-detection & filtering
- [x] Smart search, country/city/type/biryani filters
- [x] Pagination (12 per page)
- [x] Quran reader (114 surahs, Arabic + translation, audio, juz, search)
- [x] Ramadan 30-day calendar
- [x] Nearby interactive map (Leaflet) with radius filter
- [x] PWA (manifest + service worker, installable)
- [x] i18n — 6 languages (EN, BN, AR, UR, MS, TR) with RTL
- [x] Iftar/Sehri reminder notifications
- [x] Voice input/output for chatbot
- [x] Mobile-first responsive design (320px → 1920px+)
- [x] Mobile bottom navigation bar
- [x] Collapsible filter panel on mobile
- [x] Dark Islamic theme (Navy/Gold/Emerald, glassmorphism)
- [x] Toast notifications & smooth animations

---

## 📸 Screenshots

> Run the app locally or visit the deployed URL to see it in action.

---

## 📝 License

MIT — Free to use and modify.

---

## 🙏 Courtesy

Made with ❤️ by **[Mohatamim](https://www.facebook.com/mohatamim44)**
