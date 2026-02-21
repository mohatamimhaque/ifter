"""
Iftar Tracker 2026 — FastAPI Backend
Handles mosques CRUD, comments, AI chat, prayer times, and geocoding.
"""

import os
import json
import datetime
from contextlib import contextmanager
from pathlib import Path

import httpx
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Load .env (for local development)
# ---------------------------------------------------------------------------
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

# ---------------------------------------------------------------------------
# App Init
# ---------------------------------------------------------------------------

app = FastAPI(title="Iftar Tracker 2026 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_cursor(commit=False):
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        if commit:
            conn.commit()
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist, and migrate if needed."""
    with get_cursor(commit=True) as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mosques (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                area TEXT,
                city TEXT NOT NULL,
                country TEXT NOT NULL,
                lat DOUBLE PRECISION,
                lng DOUBLE PRECISION,
                has_biryani BOOLEAN DEFAULT FALSE,
                iftar_menu TEXT,
                capacity TEXT,
                contact TEXT,
                place_type TEXT DEFAULT 'Mosque',
                iftar_date DATE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                mosque_id INTEGER REFERENCES mosques(id) ON DELETE CASCADE,
                author TEXT DEFAULT 'Anonymous',
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
        # Migrate: add columns if they don't exist
        for col, coltype in [("place_type", "TEXT DEFAULT 'Mosque'"), ("iftar_date", "DATE")]:
            try:
                cur.execute(f"SELECT {col} FROM mosques LIMIT 0")
            except Exception:
                cur.connection.rollback()
                cur.execute(f"ALTER TABLE mosques ADD COLUMN {col} {coltype}")
                cur.connection.commit()


# Run on cold start
try:
    if DATABASE_URL:
        init_db()
except Exception as e:
    print(f"DB init warning: {e}")

# ---------------------------------------------------------------------------
# Static file serving (for Vercel or local dev)
# ---------------------------------------------------------------------------

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(ROOT, "index.html"))


@app.get("/style.css")
async def serve_css():
    return FileResponse(os.path.join(ROOT, "style.css"), media_type="text/css")


@app.get("/app.js")
async def serve_js():
    return FileResponse(os.path.join(ROOT, "app.js"), media_type="application/javascript")


@app.get("/favicon.svg")
async def serve_favicon():
    return FileResponse(os.path.join(ROOT, "favicon.svg"), media_type="image/svg+xml")


@app.get("/manifest.json")
async def serve_manifest():
    return FileResponse(os.path.join(ROOT, "manifest.json"), media_type="application/json")


@app.get("/sw.js")
async def serve_sw():
    return FileResponse(os.path.join(ROOT, "sw.js"), media_type="application/javascript")


@app.get("/i18n/{lang}.json")
async def serve_i18n(lang: str):
    path = os.path.join(ROOT, "i18n", f"{lang}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Language not found")
    return FileResponse(path, media_type="application/json")

# ---------------------------------------------------------------------------
# Mosque Routes
# ---------------------------------------------------------------------------

@app.get("/api/mosques")
async def list_places(
    country: str = Query(None),
    city: str = Query(None),
    search: str = Query(None),
    has_biryani: bool = Query(None),
    place_type: str = Query(None),
    iftar_date: str = Query(None),
):
    """List places with optional filters."""
    clauses = []
    params = []

    if country:
        clauses.append("LOWER(country) = LOWER(%s)")
        params.append(country)
    if city:
        clauses.append("LOWER(city) = LOWER(%s)")
        params.append(city)
    if has_biryani is not None:
        clauses.append("has_biryani = %s")
        params.append(has_biryani)
    if place_type:
        clauses.append("LOWER(place_type) = LOWER(%s)")
        params.append(place_type)
    if iftar_date:
        clauses.append("iftar_date = %s")
        params.append(iftar_date)
    if search:
        clauses.append("(LOWER(name) LIKE %s OR LOWER(area) LIKE %s OR LOWER(city) LIKE %s OR LOWER(country) LIKE %s OR LOWER(COALESCE(place_type,'')) LIKE %s)")
        s = f"%{search.lower()}%"
        params.extend([s, s, s, s, s])

    where = ""
    if clauses:
        where = "WHERE " + " AND ".join(clauses)

    query = f"""
        SELECT m.*,
               COALESCE(json_agg(
                   json_build_object('id', c.id, 'author', c.author, 'text', c.text, 'created_at', c.created_at)
               ) FILTER (WHERE c.id IS NOT NULL), '[]') AS comments
        FROM mosques m
        LEFT JOIN comments c ON c.mosque_id = m.id
        {where}
        GROUP BY m.id
        ORDER BY m.created_at DESC
    """

    with get_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    # Serialize datetimes
    result = []
    for row in rows:
        r = dict(row)
        for k, v in r.items():
            if isinstance(v, (datetime.datetime, datetime.date)):
                r[k] = v.isoformat()
        # comments is already json from the aggregate
        if isinstance(r.get("comments"), str):
            r["comments"] = json.loads(r["comments"])
        result.append(r)

    return result


@app.post("/api/mosques")
async def add_place(request: Request):
    """Add a new iftar place."""
    data = await request.json()
    required = ["name", "city", "country"]
    for field in required:
        if not data.get(field):
            raise HTTPException(status_code=400, detail=f"Missing required field: {field}")

    iftar_date = data.get("iftar_date") or None

    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO mosques (name, area, city, country, lat, lng, has_biryani, iftar_menu, capacity, contact, place_type, iftar_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            data["name"],
            data.get("area", ""),
            data["city"],
            data["country"],
            data.get("lat"),
            data.get("lng"),
            data.get("has_biryani", False),
            data.get("iftar_menu", ""),
            data.get("capacity", ""),
            data.get("contact", ""),
            data.get("place_type", "Mosque"),
            iftar_date,
        ))
        place = dict(cur.fetchone())
        for k, v in place.items():
            if isinstance(v, (datetime.datetime, datetime.date)):
                place[k] = v.isoformat()

    return place

# ---------------------------------------------------------------------------
# Comment Routes
# ---------------------------------------------------------------------------

@app.post("/api/mosques/{mosque_id}/comments")
async def add_comment(mosque_id: int, request: Request):
    """Add a comment to a mosque."""
    data = await request.json()
    if not data.get("text"):
        raise HTTPException(status_code=400, detail="Comment text is required")

    with get_cursor(commit=True) as cur:
        # Verify mosque exists
        cur.execute("SELECT id FROM mosques WHERE id = %s", (mosque_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Mosque not found")

        cur.execute("""
            INSERT INTO comments (mosque_id, author, text)
            VALUES (%s, %s, %s) RETURNING *
        """, (mosque_id, data.get("author", "Anonymous"), data["text"]))
        comment = dict(cur.fetchone())
        for k, v in comment.items():
            if isinstance(v, datetime.datetime):
                comment[k] = v.isoformat()

    return comment

# ---------------------------------------------------------------------------
# Prayer Times
# ---------------------------------------------------------------------------

@app.get("/api/prayer-times")
async def get_prayer_times(lat: float = Query(...), lng: float = Query(...)):
    """Proxy Aladhan API for prayer times (Karachi method for South Asia)."""
    today = datetime.date.today()
    url = f"https://api.aladhan.com/v1/timings/{today.strftime('%d-%m-%Y')}"
    # method=1 = University of Islamic Sciences, Karachi (Fajr 18°, Isha 18°)
    # Standard for Bangladesh, Pakistan, India
    params = {"latitude": lat, "longitude": lng, "method": 1}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Prayer times API error")
        data = resp.json()

    timings = data.get("data", {}).get("timings", {})

    # Calculate Sehri = Fajr - 3 minutes (Bangladesh Islamic Foundation standard)
    fajr_str = timings.get("Fajr", "")
    sehri = ""
    if fajr_str:
        clean = fajr_str.split("(")[0].strip()
        try:
            fajr_dt = datetime.datetime.strptime(clean, "%H:%M")
            sehri_dt = fajr_dt - datetime.timedelta(minutes=3)
            sehri = sehri_dt.strftime("%H:%M")
        except ValueError:
            sehri = fajr_str

    return {
        "sehri": sehri,
        "fajr": timings.get("Fajr"),
        "sunrise": timings.get("Sunrise"),
        "dhuhr": timings.get("Dhuhr"),
        "asr": timings.get("Asr"),
        "maghrib": timings.get("Maghrib"),
        "isha": timings.get("Isha"),
        "date": today.isoformat(),
    }

# ---------------------------------------------------------------------------
# Reverse Geocoding
# ---------------------------------------------------------------------------

@app.get("/api/location-info")
async def get_location_info(lat: float = Query(...), lng: float = Query(...)):
    """Reverse geocode lat/lng to country/city using Nominatim."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lng, "format": "json", "zoom": 10}
    headers = {"User-Agent": "IftarTracker2026/1.0"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Geocoding API error")
        data = resp.json()

    address = data.get("address", {})
    return {
        "country": address.get("country", "Unknown"),
        "city": address.get("city") or address.get("town") or address.get("village") or address.get("state", "Unknown"),
        "display_name": data.get("display_name", ""),
    }

# ---------------------------------------------------------------------------
# Country / City listing
# ---------------------------------------------------------------------------

@app.get("/api/countries")
async def list_countries():
    """List all countries with place counts."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT country, COUNT(*) as count
            FROM mosques
            GROUP BY country
            ORDER BY country
        """)
        return cur.fetchall()


@app.get("/api/cities")
async def list_cities(country: str = Query(None)):
    """List cities (optionally filtered by country)."""
    if country:
        with get_cursor() as cur:
            cur.execute("""
                SELECT city, COUNT(*) as count
                FROM mosques
                WHERE LOWER(country) = LOWER(%s)
                GROUP BY city
                ORDER BY city
            """, (country,))
            return cur.fetchall()
    else:
        with get_cursor() as cur:
            cur.execute("""
                SELECT city, country, COUNT(*) as count
                FROM mosques
                GROUP BY city, country
                ORDER BY country, city
            """)
            return cur.fetchall()

# ---------------------------------------------------------------------------
# AI Chatbot
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a friendly and knowledgeable assistant for the Iftar Tracker 2026 app.
You help users find places for iftar (mosques, restaurants, community centers, homes, etc.),
learn about biryani availability, prayer times, and Ramadan tips.
Keep responses concise, helpful, and warm. Use emojis sparingly. If you don't know something specific
about a place, suggest the user check the app's listings or add information themselves.
You can discuss Islamic topics related to Ramadan, iftar, sehri, and prayer with respect and knowledge."""


@app.post("/api/chat")
async def chat(request: Request):
    """AI chatbot endpoint powered by Groq."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI chatbot is not configured (missing GROQ_API_KEY)")

    data = await request.json()
    message = data.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    history = data.get("history", [])
    prayer_times = data.get("prayer_times")
    location = data.get("location")

    # Build dynamic context with real prayer times
    context_parts = [SYSTEM_PROMPT]
    if prayer_times:
        context_parts.append(
            f"\n\nCurrent prayer/iftar times for the user's location ({location or 'unknown'}):\n"
            f"- Sehri (last eating time): {prayer_times.get('sehri', 'N/A')}\n"
            f"- Fajr: {prayer_times.get('fajr', 'N/A')}\n"
            f"- Sunrise: {prayer_times.get('sunrise', 'N/A')}\n"
            f"- Dhuhr: {prayer_times.get('dhuhr', 'N/A')}\n"
            f"- Asr: {prayer_times.get('asr', 'N/A')}\n"
            f"- Maghrib (Iftar): {prayer_times.get('maghrib', 'N/A')}\n"
            f"- Isha: {prayer_times.get('isha', 'N/A')}\n"
            "When the user asks about prayer times, sehri, or iftar times, "
            "respond with these exact times directly. Do not tell them to check the app."
        )
    if location:
        context_parts.append(f"\nUser's detected location: {location}")

    system_content = "\n".join(context_parts)

    messages = [{"role": "system", "content": system_content}]
    for h in history[-10:]:  # Keep last 10 turns
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="AI service error")
        result = resp.json()

    reply = result["choices"][0]["message"]["content"]
    return {"reply": reply}

# ---------------------------------------------------------------------------
# Quran API (proxy alquran.cloud)
# ---------------------------------------------------------------------------

@app.get("/api/quran/surahs")
async def quran_surahs():
    """Get list of all 114 surahs."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://api.alquran.cloud/v1/surah")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Quran API error")
        data = resp.json()
    return data.get("data", [])


@app.get("/api/quran/surah/{number}")
async def quran_surah(number: int, edition: str = Query("quran-uthmani")):
    """Get a surah's ayahs in a given edition."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"https://api.alquran.cloud/v1/surah/{number}/{edition}")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Quran API error")
        data = resp.json()
    return data.get("data", {})


@app.get("/api/quran/surah/{number}/editions")
async def quran_surah_multi(number: int, editions: str = Query("quran-uthmani,bn.bengali,en.asad")):
    """Get a surah in multiple editions (Arabic + translations)."""
    eds = editions.split(",")
    results = {}
    async with httpx.AsyncClient(timeout=25) as client:
        for ed in eds:
            resp = await client.get(f"https://api.alquran.cloud/v1/surah/{number}/{ed.strip()}")
            if resp.status_code == 200:
                d = resp.json().get("data", {})
                results[ed.strip()] = d
    return results


@app.get("/api/quran/search")
async def quran_search(q: str = Query(...), edition: str = Query("en.asad")):
    """Search the Quran."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"https://api.alquran.cloud/v1/search/{q}/all/{edition}")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Quran search error")
        data = resp.json()
    return data.get("data", {})


@app.get("/api/quran/juz/{number}")
async def quran_juz(number: int, edition: str = Query("quran-uthmani")):
    """Get a Juz (para)."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"https://api.alquran.cloud/v1/juz/{number}/{edition}")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Quran API error")
        data = resp.json()
    return data.get("data", {})


@app.get("/api/quran/page/{number}")
async def quran_page(number: int, edition: str = Query("quran-uthmani")):
    """Get a page of the Quran."""
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"https://api.alquran.cloud/v1/page/{number}/{edition}")
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Quran API error")
        data = resp.json()
    return data.get("data", {})


# ---------------------------------------------------------------------------
# Ramadan Calendar (30-day prayer timetable)
# ---------------------------------------------------------------------------

@app.get("/api/ramadan-calendar")
async def ramadan_calendar(lat: float = Query(...), lng: float = Query(...), year: int = Query(2026), month: int = Query(3)):
    """Get full month of prayer times for Ramadan calendar."""
    url = f"https://api.aladhan.com/v1/calendar/{year}/{month}"
    params = {"latitude": lat, "longitude": lng, "method": 1}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Calendar API error")
        data = resp.json()

    days = []
    for day_data in data.get("data", []):
        timings = day_data.get("timings", {})
        date_info = day_data.get("date", {})
        hijri = date_info.get("hijri", {})

        # Calculate Sehri = Fajr - 3 min
        fajr_str = timings.get("Fajr", "")
        sehri = ""
        if fajr_str:
            clean = fajr_str.split("(")[0].strip()
            try:
                fajr_dt = datetime.datetime.strptime(clean, "%H:%M")
                sehri_dt = fajr_dt - datetime.timedelta(minutes=3)
                sehri = sehri_dt.strftime("%H:%M")
            except ValueError:
                sehri = fajr_str

        days.append({
            "date": date_info.get("gregorian", {}).get("date", ""),
            "hijri_date": hijri.get("date", ""),
            "hijri_month": hijri.get("month", {}).get("en", ""),
            "hijri_day": hijri.get("day", ""),
            "weekday": date_info.get("gregorian", {}).get("weekday", {}).get("en", ""),
            "sehri": sehri,
            "fajr": timings.get("Fajr", "").split("(")[0].strip(),
            "sunrise": timings.get("Sunrise", "").split("(")[0].strip(),
            "dhuhr": timings.get("Dhuhr", "").split("(")[0].strip(),
            "asr": timings.get("Asr", "").split("(")[0].strip(),
            "maghrib": timings.get("Maghrib", "").split("(")[0].strip(),
            "isha": timings.get("Isha", "").split("(")[0].strip(),
        })

    return days


# ---------------------------------------------------------------------------
# AI Recommendations
# ---------------------------------------------------------------------------

@app.post("/api/recommend")
async def recommend_places(request: Request):
    """AI-powered place recommendations."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI not configured")

    data = await request.json()
    user_lat = data.get("lat")
    user_lng = data.get("lng")
    user_location = data.get("location", "Unknown")
    preference = data.get("preference", "best iftar near me")

    # Get all places
    with get_cursor() as cur:
        cur.execute("SELECT name, area, city, country, lat, lng, has_biryani, iftar_menu, place_type, iftar_date FROM mosques ORDER BY created_at DESC LIMIT 100")
        rows = cur.fetchall()

    places_text = "\n".join([
        f"- {r['name']} ({r['place_type']}) in {r.get('area','')}, {r['city']}, {r['country']}" +
        (f" | Menu: {r['iftar_menu']}" if r.get('iftar_menu') else "") +
        (f" | Biryani: Yes" if r.get('has_biryani') else "") +
        (f" | Date: {r['iftar_date']}" if r.get('iftar_date') else "") +
        (f" | Coords: {r['lat']},{r['lng']}" if r.get('lat') else "")
        for r in rows
    ])

    messages = [
        {"role": "system", "content": f"""You are an AI that recommends the best iftar places.
User is at: {user_location} (lat: {user_lat}, lng: {user_lng}).
Here are the available places:\n{places_text}\n\nGive top 3-5 recommendations based on the user's preference.
Consider distance, menu variety, and biryani availability.
Be concise, friendly, and helpful. Use emojis."""},
        {"role": "user", "content": preference}
    ]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": messages, "temperature": 0.7, "max_tokens": 1024},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="AI service error")
        result = resp.json()

    return {"recommendation": result["choices"][0]["message"]["content"]}
