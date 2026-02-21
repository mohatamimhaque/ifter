/* ==========================================================================
   Iftar Tracker 2026 — Frontend Logic
   Chatbot, Maps, Filters, Countdown, Location Detection, Quran, Calendar,
   Nearby Map, AI Recommendations, Notifications, PWA, i18n
   ========================================================================== */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let places = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 12;
let filteredPlaces = [];
let userLat = null;
let userLng = null;
let userCountry = '';
let userCity = '';
let chatHistory = [];
let countdownInterval = null;
let prayerTimes = null;
let currentLang = 'en';
let i18nData = {};

// Quran state
let surahList = [];
let currentSurahNumber = null;

// Nearby map state
let nearbyMap = null;
let nearbyMarkers = [];
let nearbyRadius = 3;
let nearbyCircle = null;

// Reminder state
let reminderTimers = [];

const API = '';  // same origin

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  detectLocation();
  loadPlaces();
  loadCountries();
  setupEventListeners();
  registerSW();
  loadSavedLanguage();
  loadReminderSettings();
});

// ---------------------------------------------------------------------------
// PWA Service Worker
// ---------------------------------------------------------------------------
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
  }
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`.nav-tab[data-tab="${tab}"]`).classList.add('active');

  // Lazy-load tab content
  if (tab === 'quran' && surahList.length === 0) {
    loadSurahList();
    populateJuzSelect();
  }
  if (tab === 'calendar') {
    loadRamadanCalendar();
  }
  if (tab === 'nearby') {
    initNearbyMap();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 400));
  document.getElementById('countryFilter').addEventListener('change', () => {
    loadCities(document.getElementById('countryFilter').value);
    applyFilters();
  });
  document.getElementById('cityFilter').addEventListener('change', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);
  document.getElementById('dateFilter').addEventListener('change', applyFilters);
  document.getElementById('biryaniFilter').addEventListener('change', applyFilters);
  document.getElementById('addMosqueBtn').addEventListener('click', openAddModal);
  document.getElementById('addMosqueForm').addEventListener('submit', handleAddPlace);
  document.getElementById('chatForm').addEventListener('submit', handleChatSubmit);

  // Quran search on Enter
  document.getElementById('quranSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchQuran();
  });
}

// ---------------------------------------------------------------------------
// Location Detection
// ---------------------------------------------------------------------------
function detectLocation() {
  if (!navigator.geolocation) {
    document.getElementById('locationText').textContent = 'Location not available';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;

      document.getElementById('mosqueLat').value = userLat.toFixed(6);
      document.getElementById('mosqueLng').value = userLng.toFixed(6);
      if (mapPicker) {
        mapPicker.setView([userLat, userLng], 15);
        setMapPin(userLat, userLng);
      }

      try {
        const res = await fetch(`${API}/api/location-info?lat=${userLat}&lng=${userLng}`);
        const data = await res.json();
        userCountry = data.country;
        userCity = data.city;
        document.getElementById('locationText').textContent = `${data.city}, ${data.country}`;
        document.getElementById('calLocationText').textContent = `${data.city}, ${data.country}`;
        document.getElementById('mosqueCity').value = data.city || '';
        document.getElementById('mosqueCountry').value = data.country || 'Bangladesh';
      } catch {
        document.getElementById('locationText').textContent = `${userLat.toFixed(2)}°, ${userLng.toFixed(2)}°`;
      }

      loadPrayerTimes(userLat, userLng);
    },
    () => {
      document.getElementById('locationText').textContent = 'Location denied — search manually';
    }
  );
}

// ---------------------------------------------------------------------------
// Prayer Times & Countdown
// ---------------------------------------------------------------------------
async function loadPrayerTimes(lat, lng) {
  try {
    const res = await fetch(`${API}/api/prayer-times?lat=${lat}&lng=${lng}`);
    prayerTimes = await res.json();

    document.getElementById('sehriTime').textContent = prayerTimes.sehri || '--:--';
    document.getElementById('iftarTime').textContent = prayerTimes.maghrib || '--:--';

    startCountdown();
    scheduleReminders();
  } catch (e) {
    console.error('Prayer times error:', e);
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  function update() {
    if (!prayerTimes) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const sehriTime = parseTime(prayerTimes.sehri, today);
    const maghribTime = parseTime(prayerTimes.maghrib, today);

    let target, label;

    if (now < sehriTime) {
      target = sehriTime;
      label = 'Sehri Ends In';
    } else if (now < maghribTime) {
      target = maghribTime;
      label = 'Iftar In';
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      target = parseTime(prayerTimes.sehri, tomorrowStr);
      label = 'Next Sehri In';
    }

    document.getElementById('countdownLabel').textContent = label;

    const diff = target - now;
    if (diff <= 0) {
      document.getElementById('countdownTimer').textContent = '00:00:00';
      return;
    }

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    document.getElementById('countdownTimer').textContent =
      `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

function parseTime(timeStr, dateStr) {
  if (!timeStr) return new Date(0);
  const clean = timeStr.replace(/\s*\(.*\)/, '').trim();
  return new Date(`${dateStr}T${clean}:00`);
}

function pad(n) {
  return n.toString().padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Load Places
// ---------------------------------------------------------------------------
async function loadPlaces() {
  try {
    const res = await fetch(`${API}/api/mosques`);
    let data = await res.json();

    const today = new Date().toISOString().split('T')[0];
    places = data.filter(m => !m.iftar_date || m.iftar_date >= today);

    filteredPlaces = places;
    currentPage = 1;
    renderPage();
  } catch (e) {
    console.error('Error loading places:', e);
    filteredPlaces = [];
    currentPage = 1;
    renderPage();
  }
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const country = document.getElementById('countryFilter').value;
  const city = document.getElementById('cityFilter').value;
  const placeType = document.getElementById('typeFilter').value;
  const dateVal = document.getElementById('dateFilter').value;
  const biryaniOnly = document.getElementById('biryaniFilter').checked;

  let filtered = places;

  if (search) {
    filtered = filtered.filter(m =>
      (m.name || '').toLowerCase().includes(search) ||
      (m.area || '').toLowerCase().includes(search) ||
      (m.city || '').toLowerCase().includes(search) ||
      (m.country || '').toLowerCase().includes(search) ||
      (m.place_type || '').toLowerCase().includes(search)
    );
  }

  if (country) {
    filtered = filtered.filter(m => m.country && m.country.toLowerCase() === country.toLowerCase());
  }

  if (city) {
    filtered = filtered.filter(m => m.city && m.city.toLowerCase() === city.toLowerCase());
  }

  if (placeType) {
    filtered = filtered.filter(m => m.place_type && m.place_type.toLowerCase() === placeType.toLowerCase());
  }

  if (dateVal) {
    filtered = filtered.filter(m => m.iftar_date === dateVal);
  }

  if (biryaniOnly) {
    filtered = filtered.filter(m => m.has_biryani);
  }

  filteredPlaces = filtered;
  currentPage = 1;
  renderPage();
}

function renderPage() {
  const total = filteredPlaces.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredPlaces.slice(start, start + ITEMS_PER_PAGE);

  renderPlaces(pageItems);
  updateCount(total);
  renderPagination(totalPages);
}

function updateCount(n) {
  document.getElementById('mosqueCount').textContent = `${n} place${n !== 1 ? 's' : ''}`;
}

function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px">chevron_left</span>';
  prev.disabled = currentPage === 1;
  prev.addEventListener('click', () => goToPage(currentPage - 1));
  container.appendChild(prev);

  const pages = getPageNumbers(currentPage, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      const dots = document.createElement('span');
      dots.className = 'page-dots';
      dots.textContent = '…';
      container.appendChild(dots);
    } else {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = p;
      btn.addEventListener('click', () => goToPage(p));
      container.appendChild(btn);
    }
  });

  const next = document.createElement('button');
  next.className = 'page-btn';
  next.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px">chevron_right</span>';
  next.disabled = currentPage === totalPages;
  next.addEventListener('click', () => goToPage(currentPage + 1));
  container.appendChild(next);
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function goToPage(page) {
  currentPage = page;
  renderPage();
  document.querySelector('.mosques-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Render Places
// ---------------------------------------------------------------------------
const PLACE_ICONS = {
  'Mosque': 'mosque',
  'Restaurant': 'restaurant',
  'Community Center': 'groups',
  'Home': 'home',
  'Madrasa': 'school',
  'Other': 'place',
};

function renderPlaces(list) {
  const grid = document.getElementById('mosqueGrid');
  const empty = document.getElementById('emptyState');

  grid.querySelectorAll('.mosque-card').forEach(c => c.remove());

  if (list.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  list.forEach(m => {
    const card = document.createElement('div');
    card.className = 'mosque-card';
    card.dataset.id = m.id;

    const mapsUrl = m.lat && m.lng
      ? `https://www.google.com/maps?q=${m.lat},${m.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(m.name + ' ' + m.city)}`;

    const comments = Array.isArray(m.comments) ? m.comments : [];
    const typeIcon = PLACE_ICONS[m.place_type] || 'place';
    const dateStr = m.iftar_date ? new Date(m.iftar_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    card.innerHTML = `
      <div class="mosque-card-header">
        <div class="card-title-row">
          <span class="material-symbols-rounded card-type-icon" style="font-size:20px">${typeIcon}</span>
          <span class="mosque-name">${esc(m.name)}</span>
        </div>
        <div class="card-badges">
          <span class="type-badge">${esc(m.place_type || 'Mosque')}</span>
          ${m.has_biryani ? '<span class="biryani-badge"><span class="material-symbols-rounded" style="font-size:14px">restaurant</span> Biryani</span>' : ''}
        </div>
      </div>
      <div class="mosque-location">
        <span class="material-symbols-rounded" style="font-size:16px">location_on</span> ${esc(m.area ? m.area + ', ' : '')}${esc(m.city)}, ${esc(m.country)}
      </div>
      <div class="mosque-meta">
        ${dateStr ? `<div class="mosque-meta-item"><span class="material-symbols-rounded mosque-meta-icon">calendar_month</span> ${dateStr}</div>` : ''}
        ${m.iftar_menu ? `<div class="mosque-meta-item"><span class="material-symbols-rounded mosque-meta-icon">restaurant_menu</span> ${esc(m.iftar_menu)}</div>` : ''}
      </div>
      <div class="mosque-actions">
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm"><span class="material-symbols-rounded" style="font-size:16px">map</span> Maps</a>
        <button class="btn btn-secondary btn-sm" onclick="toggleComments(${m.id})"><span class="material-symbols-rounded" style="font-size:16px">chat</span> ${comments.length} Comment${comments.length !== 1 ? 's' : ''}</button>
      </div>
      <div class="comments-section" id="comments-${m.id}" style="display:none;">
        <div class="comments-title">Comments</div>
        <div class="comments-list" id="commentList-${m.id}">
          ${comments.map(c => commentHTML(c)).join('')}
        </div>
        <div class="comment-form">
          <input type="text" placeholder="Add a comment…" id="commentInput-${m.id}" onkeydown="if(event.key==='Enter')submitComment(${m.id})" />
          <button class="btn btn-gold btn-sm" onclick="submitComment(${m.id})">Post</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function commentHTML(c) {
  const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : '';
  return `
    <div class="comment-item">
      <span class="comment-author">${esc(c.author || 'Anonymous')}</span>
      <span class="comment-text">${esc(c.text)}</span>
      ${date ? `<div class="comment-date">${date}</div>` : ''}
    </div>
  `;
}

function toggleComments(id) {
  const section = document.getElementById(`comments-${id}`);
  if (section) {
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
  }
}

async function submitComment(mosqueId) {
  const input = document.getElementById(`commentInput-${mosqueId}`);
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${API}/api/mosques/${mosqueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, author: 'Anonymous' }),
    });
    if (!res.ok) throw new Error('Failed');
    const comment = await res.json();

    const list = document.getElementById(`commentList-${mosqueId}`);
    list.insertAdjacentHTML('beforeend', commentHTML(comment));
    input.value = '';
    showToast('Comment added!', 'success');

    const place = places.find(m => m.id === mosqueId);
    if (place) {
      if (!Array.isArray(place.comments)) place.comments = [];
      place.comments.push(comment);
    }
  } catch {
    showToast('Failed to add comment', 'error');
  }
}

// ---------------------------------------------------------------------------
// Add Place
// ---------------------------------------------------------------------------
function openAddModal() {
  document.getElementById('addMosqueModal').classList.add('active');
  initMapPicker();
}

function closeAddModal() {
  document.getElementById('addMosqueModal').classList.remove('active');
}

async function handleAddPlace(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span> Adding…';

  const data = {
    name: document.getElementById('mosqueName').value.trim(),
    place_type: document.getElementById('placeType').value,
    area: document.getElementById('mosqueArea').value.trim(),
    iftar_date: document.getElementById('iftarDate').value || null,
    city: document.getElementById('mosqueCity').value.trim(),
    country: document.getElementById('mosqueCountry').value.trim(),
    lat: parseFloat(document.getElementById('mosqueLat').value) || null,
    lng: parseFloat(document.getElementById('mosqueLng').value) || null,
    has_biryani: document.getElementById('mosqueBiryani').checked,
    iftar_menu: document.getElementById('mosqueMenu').value.trim(),
    capacity: '',
    contact: '',
  };

  if (!data.name || !data.city || !data.country) {
    showToast('Please fill in required fields (Name, City, Country)', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-rounded">add_location_alt</span> Add Place';
    return;
  }

  try {
    const res = await fetch(`${API}/api/mosques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed');
    }

    const place = await res.json();
    place.comments = [];
    places.unshift(place);
    applyFilters();
    loadCountries();

    closeAddModal();
    document.getElementById('addMosqueForm').reset();
    document.getElementById('mosqueCountry').value = 'Bangladesh';
    showToast('Place added successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to add place', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-rounded">add_location_alt</span> Add Place';
  }
}

// ---------------------------------------------------------------------------
// Countries & Cities
// ---------------------------------------------------------------------------
async function loadCountries() {
  try {
    const res = await fetch(`${API}/api/countries`);
    const countries = await res.json();
    const select = document.getElementById('countryFilter');
    const current = select.value;

    select.innerHTML = '<option value="">All Countries</option>';
    countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.country;
      opt.textContent = `${c.country} (${c.count})`;
      select.appendChild(opt);
    });

    if (current) select.value = current;
  } catch (e) {
    console.error('Error loading countries:', e);
  }
}

async function loadCities(country) {
  const select = document.getElementById('cityFilter');
  select.innerHTML = '<option value="">All Cities</option>';

  if (!country) return;

  try {
    const res = await fetch(`${API}/api/cities?country=${encodeURIComponent(country)}`);
    const cities = await res.json();
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.city;
      opt.textContent = `${c.city} (${c.count})`;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Error loading cities:', e);
  }
}

// ---------------------------------------------------------------------------
// AI Chatbot
// ---------------------------------------------------------------------------
function toggleChat() {
  const win = document.getElementById('chatWindow');
  win.classList.toggle('active');
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  appendMessage('user', message);
  input.value = '';

  const typing = appendTypingIndicator();

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-10),
        prayer_times: prayerTimes || null,
        location: userCity && userCountry ? `${userCity}, ${userCountry}` : null,
      }),
    });

    typing.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'AI service error');
    }

    const data = await res.json();
    const bubbleEl = appendMessage('bot', data.reply);

    speakText(data.reply, bubbleEl);

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: data.reply });
  } catch (err) {
    typing.remove();
    appendMessage('bot', `Sorry, I encountered an error: ${err.message}`);
  }
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `<div class="chat-bubble">${escChat(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.querySelector('.chat-bubble');
}

function appendTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = `<div class="chat-bubble typing-indicator"><span></span><span></span><span></span></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ---------------------------------------------------------------------------
// AI Recommendations
// ---------------------------------------------------------------------------
async function getAIRecommendation() {
  const btn = document.getElementById('aiRecommendBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-rounded">hourglass_top</span> Thinking…';

  try {
    const res = await fetch(`${API}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: userLat,
        lng: userLng,
        location: userCity && userCountry ? `${userCity}, ${userCountry}` : 'Unknown',
        preference: 'Suggest the best iftar places near me with good food and biryani',
      }),
    });

    if (!res.ok) throw new Error('AI service error');
    const data = await res.json();

    const resultDiv = document.getElementById('aiRecommendResult');
    document.getElementById('recommendBody').innerHTML = escChat(data.recommendation);
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast('AI recommendation failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-rounded">auto_awesome</span> AI Suggest';
  }
}

// ---------------------------------------------------------------------------
// Voice Support (Speech-to-Text & Text-to-Speech)
// ---------------------------------------------------------------------------
let voiceRecognition = null;
let isRecording = false;
let voiceOutputEnabled = false;
let currentUtterance = null;

function toggleVoiceInput() {
  if (isRecording) {
    stopVoiceInput();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Speech recognition not supported in this browser', 'error');
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = 'bn-BD';
  voiceRecognition.interimResults = true;
  voiceRecognition.continuous = false;
  voiceRecognition.maxAlternatives = 1;

  const micBtn = document.getElementById('voiceMicBtn');
  const chatInput = document.getElementById('chatInput');

  voiceRecognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    chatInput.placeholder = 'Listening…';
  };

  voiceRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    chatInput.value = transcript;
  };

  voiceRecognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    chatInput.placeholder = 'Ask about iftar, places, biryani…';

    if (chatInput.value.trim()) {
      document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true }));
    }
  };

  voiceRecognition.onerror = (event) => {
    isRecording = false;
    micBtn.classList.remove('recording');
    chatInput.placeholder = 'Ask about iftar, places, biryani…';
    if (event.error === 'no-speech') {
      showToast('No speech detected, try again', 'error');
    } else if (event.error !== 'aborted') {
      showToast(`Voice error: ${event.error}`, 'error');
    }
  };

  try {
    voiceRecognition.start();
  } catch (e) {
    showToast('Could not start voice input', 'error');
  }
}

function stopVoiceInput() {
  if (voiceRecognition) {
    voiceRecognition.stop();
    voiceRecognition = null;
  }
  isRecording = false;
  document.getElementById('voiceMicBtn').classList.remove('recording');
}

function toggleVoiceOutput() {
  voiceOutputEnabled = !voiceOutputEnabled;
  const btn = document.getElementById('voiceSpeakerBtn');
  const icon = document.getElementById('voiceSpeakerIcon');

  if (voiceOutputEnabled) {
    btn.classList.add('active-speaker');
    icon.textContent = 'volume_up';
    showToast('Voice replies ON', 'success');
  } else {
    btn.classList.remove('active-speaker');
    icon.textContent = 'volume_off';
    stopSpeaking();
    showToast('Voice replies OFF', 'info');
  }
}

function speakText(text, bubbleEl) {
  if (!voiceOutputEnabled) return;
  if (!window.speechSynthesis) {
    showToast('Text-to-speech not supported', 'error');
    return;
  }

  stopSpeaking();

  const cleanText = text
    .replace(/[\*#_~`]/g, '')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  currentUtterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance.rate = 1.0;
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;

  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('bn')) ||
                    voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                    voices.find(v => v.lang.startsWith('en'));
  if (preferred) currentUtterance.voice = preferred;

  if (bubbleEl) bubbleEl.classList.add('speaking');

  currentUtterance.onend = () => {
    if (bubbleEl) bubbleEl.classList.remove('speaking');
    currentUtterance = null;
  };
  currentUtterance.onerror = () => {
    if (bubbleEl) bubbleEl.classList.remove('speaking');
    currentUtterance = null;
  };

  speechSynthesis.speak(currentUtterance);
}

function stopSpeaking() {
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  currentUtterance = null;
  document.querySelectorAll('.chat-bubble.speaking').forEach(el => el.classList.remove('speaking'));
}

if (window.speechSynthesis) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

// ===========================================================================
// QURAN FEATURE
// ===========================================================================
async function loadSurahList() {
  try {
    const res = await fetch(`${API}/api/quran/surahs`);
    surahList = await res.json();

    const listEl = document.getElementById('surahList');
    listEl.innerHTML = '';

    surahList.forEach(s => {
      const item = document.createElement('div');
      item.className = 'surah-item';
      item.dataset.number = s.number;
      item.onclick = () => loadSurah(s.number);
      item.innerHTML = `
        <span class="surah-number">${s.number}</span>
        <div class="surah-info">
          <span class="surah-name-en">${esc(s.englishName)}</span>
          <span class="surah-name-ar">${esc(s.name)}</span>
        </div>
        <div class="surah-meta-right">
          <span class="surah-ayahs">${s.numberOfAyahs} ayahs</span>
          <span class="surah-type-badge">${s.revelationType}</span>
        </div>
      `;
      listEl.appendChild(item);
    });
  } catch (e) {
    console.error('Error loading surahs:', e);
    document.getElementById('surahList').innerHTML = '<p style="padding:16px;color:var(--text-muted)">Failed to load surahs. Please try again.</p>';
  }
}

function populateJuzSelect() {
  const select = document.getElementById('quranJuzSelect');
  select.innerHTML = '<option value="">Select Juz/Para</option>';
  for (let i = 1; i <= 30; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Juz ${i}`;
    select.appendChild(opt);
  }
}

async function loadSurah(number) {
  currentSurahNumber = number;

  // Highlight sidebar item
  document.querySelectorAll('.surah-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.querySelector(`.surah-item[data-number="${number}"]`);
  if (activeItem) activeItem.classList.add('active');

  const contentEl = document.getElementById('quranContent');
  contentEl.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Loading surah…</p></div>';

  const edition = document.getElementById('quranEdition').value;

  try {
    // Fetch Arabic + selected translation
    const res = await fetch(`${API}/api/quran/surah/${number}/editions?editions=quran-uthmani,${edition}`);
    const data = await res.json();

    const arabic = data['quran-uthmani'] || {};
    const translation = data[edition] || {};

    const surahInfo = arabic.name ? arabic : (surahList.find(s => s.number === number) || {});
    const arabicAyahs = arabic.ayahs || [];
    const transAyahs = translation.ayahs || [];

    let audioUrl = '';
    if (number >= 1 && number <= 114) {
      audioUrl = `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${String(number).padStart(3, '0')}.mp3`;
    }

    let html = `
      <div class="surah-content-header">
        <div class="surah-title-row">
          <h2 class="surah-content-title">${esc(surahInfo.englishName || surahInfo.name || 'Surah ' + number)}</h2>
          <span class="surah-arabic-title">${esc(surahInfo.name || '')}</span>
        </div>
        <div class="surah-content-meta">
          <span>${esc(surahInfo.englishNameTranslation || '')}</span>
          <span>•</span>
          <span>${arabicAyahs.length} Ayahs</span>
          <span>•</span>
          <span>${esc(surahInfo.revelationType || '')}</span>
        </div>
        ${audioUrl ? `
        <div class="surah-audio">
          <audio controls preload="none" src="${audioUrl}" style="width:100%;max-width:400px;height:36px;"></audio>
        </div>` : ''}
      </div>
    `;

    // Bismillah (skip for At-Tawbah, surah 9)
    if (number !== 9 && number !== 1) {
      html += `<div class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>`;
    }

    html += '<div class="ayahs-container">';

    arabicAyahs.forEach((ayah, i) => {
      const trans = transAyahs[i] || {};
      html += `
        <div class="ayah-block">
          <div class="ayah-number-badge">${ayah.numberInSurah}</div>
          <div class="ayah-text-arabic">${ayah.text}</div>
          <div class="ayah-text-translation">${esc(trans.text || '')}</div>
        </div>
      `;
    });

    html += '</div>';

    // Navigation buttons
    html += '<div class="surah-nav-btns">';
    if (number > 1) {
      html += `<button class="btn btn-secondary" onclick="loadSurah(${number - 1})"><span class="material-symbols-rounded">chevron_left</span> Previous Surah</button>`;
    }
    if (number < 114) {
      html += `<button class="btn btn-primary" onclick="loadSurah(${number + 1})">Next Surah <span class="material-symbols-rounded">chevron_right</span></button>`;
    }
    html += '</div>';

    contentEl.innerHTML = html;
    contentEl.scrollTop = 0;

  } catch (e) {
    console.error('Error loading surah:', e);
    contentEl.innerHTML = '<div class="quran-empty-state"><p style="color:#ef4444;">Failed to load surah. Please try again.</p></div>';
  }
}

function loadCurrentSurah() {
  if (currentSurahNumber) loadSurah(currentSurahNumber);
}

async function loadJuz(juzNumber) {
  if (!juzNumber) return;

  const contentEl = document.getElementById('quranContent');
  contentEl.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p style="margin-top:12px;color:var(--text-muted)">Loading Juz…</p></div>';

  try {
    const res = await fetch(`${API}/api/quran/juz/${juzNumber}`);
    const data = await res.json();

    const ayahs = data.ayahs || [];

    let html = `
      <div class="surah-content-header">
        <h2 class="surah-content-title">Juz ${juzNumber}</h2>
        <div class="surah-content-meta"><span>${ayahs.length} Ayahs</span></div>
      </div>
      <div class="ayahs-container">
    `;

    let currentSurah = '';
    ayahs.forEach(ayah => {
      const surahName = ayah.surah ? ayah.surah.englishName : '';
      if (surahName !== currentSurah) {
        currentSurah = surahName;
        html += `<div class="juz-surah-divider"><span class="material-symbols-rounded">menu_book</span> ${esc(surahName)} (${esc(ayah.surah ? ayah.surah.name : '')})</div>`;
      }
      html += `
        <div class="ayah-block">
          <div class="ayah-number-badge">${ayah.numberInSurah}</div>
          <div class="ayah-text-arabic">${ayah.text}</div>
        </div>
      `;
    });

    html += '</div>';
    contentEl.innerHTML = html;
    contentEl.scrollTop = 0;
  } catch (e) {
    contentEl.innerHTML = '<div class="quran-empty-state"><p style="color:#ef4444;">Failed to load Juz.</p></div>';
  }
}

async function searchQuran() {
  const query = document.getElementById('quranSearchInput').value.trim();
  if (!query) return;

  const resultsEl = document.getElementById('quranSearchResults');
  const bodyEl = document.getElementById('searchResultsBody');
  resultsEl.style.display = 'block';
  bodyEl.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div></div>';

  try {
    const res = await fetch(`${API}/api/quran/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    const matches = data.matches || [];

    if (matches.length === 0) {
      bodyEl.innerHTML = '<p style="padding:16px;color:var(--text-muted)">No results found.</p>';
      return;
    }

    let html = `<p style="padding:8px 16px;color:var(--text-secondary);font-size:0.85rem;">${data.count || matches.length} results found</p>`;

    matches.slice(0, 50).forEach(m => {
      html += `
        <div class="search-result-item" onclick="loadSurah(${m.surah.number})">
          <div class="search-result-ref">${esc(m.surah.englishName)} ${m.numberInSurah}</div>
          <div class="search-result-text">${esc(m.text)}</div>
        </div>
      `;
    });

    bodyEl.innerHTML = html;
  } catch (e) {
    bodyEl.innerHTML = '<p style="padding:16px;color:#ef4444;">Search failed. Please try again.</p>';
  }
}

// ===========================================================================
// RAMADAN CALENDAR
// ===========================================================================
let calendarLoaded = false;

async function loadRamadanCalendar() {
  if (!userLat || !userLng) {
    document.getElementById('calendarBody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted)">Waiting for location… Please allow location access.</td></tr>';
    return;
  }

  const month = document.getElementById('calMonthSelect').value;

  document.getElementById('calendarBody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;"><div class="loading-spinner"></div></td></tr>';

  try {
    const res = await fetch(`${API}/api/ramadan-calendar?lat=${userLat}&lng=${userLng}&year=2026&month=${month}`);
    const days = await res.json();

    const today = new Date().toISOString().split('T')[0];

    let html = '';
    days.forEach((d, i) => {
      const dateObj = d.date ? d.date.split('-').reverse().join('-') : '';
      const isToday = dateObj === today;
      html += `
        <tr class="${isToday ? 'calendar-today' : ''}">
          <td>${d.weekday ? d.weekday.substring(0, 3) : ''}</td>
          <td>${d.date || ''}</td>
          <td>${d.hijri_day || ''} ${d.hijri_month || ''}</td>
          <td class="cal-sehri">${d.sehri || ''}</td>
          <td>${d.fajr || ''}</td>
          <td>${d.sunrise || ''}</td>
          <td>${d.dhuhr || ''}</td>
          <td>${d.asr || ''}</td>
          <td class="cal-iftar">${d.maghrib || ''}</td>
          <td>${d.isha || ''}</td>
        </tr>
      `;
    });

    document.getElementById('calendarBody').innerHTML = html;
    calendarLoaded = true;
  } catch (e) {
    console.error('Calendar error:', e);
    document.getElementById('calendarBody').innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#ef4444;">Failed to load calendar. Please try again.</td></tr>';
  }
}

// ===========================================================================
// NEARBY PLACES MAP
// ===========================================================================
function initNearbyMap() {
  if (nearbyMap) {
    nearbyMap.invalidateSize();
    updateNearbyMarkers();
    return;
  }

  const lat = userLat || 23.8;
  const lng = userLng || 90.4;

  setTimeout(() => {
    const container = document.getElementById('nearbyMap');
    if (!container) return;

    nearbyMap = L.map('nearbyMap', {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(nearbyMap);

    // User location marker
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: '<div class="user-marker-dot"></div>',
      iconSize: [20, 20],
    });

    if (userLat && userLng) {
      L.marker([userLat, userLng], { icon: userIcon }).addTo(nearbyMap)
        .bindPopup('<strong>Your Location</strong>');
    }

    updateNearbyMarkers();
  }, 200);
}

function setNearbyRadius(km) {
  nearbyRadius = km;
  document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.radius-btn[data-km="${km}"]`).classList.add('active');
  updateNearbyMarkers();
}

function updateNearbyMarkers() {
  if (!nearbyMap) return;

  // Remove existing markers & circle
  nearbyMarkers.forEach(m => nearbyMap.removeLayer(m));
  nearbyMarkers = [];
  if (nearbyCircle) nearbyMap.removeLayer(nearbyCircle);

  const centerLat = userLat || 23.8;
  const centerLng = userLng || 90.4;

  // Draw radius circle
  nearbyCircle = L.circle([centerLat, centerLng], {
    radius: nearbyRadius * 1000,
    color: '#FFD700',
    fillColor: '#FFD700',
    fillOpacity: 0.08,
    weight: 2,
  }).addTo(nearbyMap);

  // Filter places within radius
  const nearbyPlaces = places.filter(p => {
    if (!p.lat || !p.lng) return false;
    const dist = getDistanceKm(centerLat, centerLng, p.lat, p.lng);
    return dist <= nearbyRadius;
  });

  document.getElementById('nearbyCount').textContent = `${nearbyPlaces.length} place${nearbyPlaces.length !== 1 ? 's' : ''} found`;

  nearbyPlaces.forEach(p => {
    const typeIcon = PLACE_ICONS[p.place_type] || 'place';
    const dist = getDistanceKm(centerLat, centerLng, p.lat, p.lng).toFixed(1);
    const locationStr = [p.area, p.city, p.country].filter(Boolean).join(', ');

    const popupHtml = `
      <div style="font-family:system-ui,sans-serif;min-width:220px;max-width:280px;padding:4px;">
        <div style="font-size:1rem;font-weight:700;color:#0a1628;margin-bottom:4px;">${esc(p.name)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="background:#e8f5e9;color:#2e7d32;font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:12px;">${esc(p.place_type || 'Mosque')}</span>
          <span style="color:#666;font-size:0.78rem;">${dist} km away</span>
        </div>
        <div style="font-size:0.82rem;color:#444;margin-bottom:4px;">📍 ${esc(locationStr)}</div>
        ${p.iftar_date ? `<div style="font-size:0.82rem;color:#444;margin-bottom:4px;">📅 ${esc(p.iftar_date)}</div>` : ''}
        ${p.iftar_menu ? `<div style="font-size:0.82rem;color:#444;margin-bottom:4px;">🍽️ <strong>Menu:</strong> ${esc(p.iftar_menu)}</div>` : ''}
        ${p.has_biryani ? '<div style="font-size:0.82rem;color:#b8860b;font-weight:600;margin-bottom:4px;">🍚 Biryani Available!</div>' : ''}
        <div style="font-size:0.72rem;color:#999;margin-top:4px;">Lat: ${p.lat?.toFixed(4)}, Lng: ${p.lng?.toFixed(4)}</div>
      </div>
    `;

    const marker = L.marker([p.lat, p.lng]).addTo(nearbyMap);

    // Show tooltip on hover with name + type
    marker.bindTooltip(`<strong>${esc(p.name)}</strong><br/>${esc(p.place_type || 'Mosque')} • ${dist} km`, {
      direction: 'top',
      offset: [0, -10],
      opacity: 0.95,
      className: 'nearby-tooltip'
    });

    // Show full details popup on click
    marker.bindPopup(popupHtml, { maxWidth: 300 });
    nearbyMarkers.push(marker);
  });

  // Build nearby list
  const listEl = document.getElementById('nearbyList');
  if (nearbyPlaces.length === 0) {
    listEl.innerHTML = '<div class="nearby-empty"><span class="material-symbols-rounded">location_off</span> No places found within this radius. Try increasing the range or add new places!</div>';
  } else {
    let html = '<div class="nearby-cards">';
    nearbyPlaces.forEach(p => {
      const dist = getDistanceKm(centerLat, centerLng, p.lat, p.lng).toFixed(1);
      const typeIcon = PLACE_ICONS[p.place_type] || 'place';
      const locationStr = [p.area, p.city, p.country].filter(Boolean).join(', ');
      html += `
        <div class="nearby-card glass-card" onclick="nearbyMap.setView([${p.lat},${p.lng}],16)">
          <div class="nearby-card-header">
            <span class="nearby-card-name"><span class="material-symbols-rounded" style="color:var(--emerald);font-size:18px;vertical-align:middle;margin-right:4px;">${typeIcon}</span>${esc(p.name)}</span>
            <span class="nearby-distance">${dist} km</span>
          </div>
          <div class="nearby-card-info"><span class="material-symbols-rounded">category</span> ${esc(p.place_type || 'Mosque')}</div>
          <div class="nearby-card-info"><span class="material-symbols-rounded">location_on</span> ${esc(locationStr)}</div>
          ${p.iftar_date ? `<div class="nearby-card-info"><span class="material-symbols-rounded">calendar_month</span> ${esc(p.iftar_date)}</div>` : ''}
          ${p.iftar_menu ? `<div class="nearby-card-info"><span class="material-symbols-rounded">restaurant_menu</span> ${esc(p.iftar_menu)}</div>` : ''}
          ${p.has_biryani ? '<div class="nearby-card-badge"><span class="biryani-badge" style="font-size:0.7rem;padding:3px 8px;">🍚 Biryani</span></div>' : ''}
        </div>
      `;
    });
    html += '</div>';
    listEl.innerHTML = html;
  }

  // Fit map to circle bounds
  nearbyMap.fitBounds(nearbyCircle.getBounds(), { padding: [20, 20] });
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===========================================================================
// IFTAR REMINDER NOTIFICATIONS
// ===========================================================================
function openReminderSettings() {
  document.getElementById('reminderModal').classList.add('active');
  updateReminderStatus();
}

function closeReminderModal() {
  document.getElementById('reminderModal').classList.remove('active');
}

function updateReminderStatus() {
  const status = document.getElementById('reminderStatus');
  if (!('Notification' in window)) {
    status.innerHTML = '<span class="material-symbols-rounded">warning</span> Notifications not supported in this browser';
  } else if (Notification.permission === 'granted') {
    status.innerHTML = '<span class="material-symbols-rounded" style="color:var(--emerald)">check_circle</span> Notifications enabled! You will be reminded before iftar.';
  } else if (Notification.permission === 'denied') {
    status.innerHTML = '<span class="material-symbols-rounded" style="color:#ef4444">block</span> Notifications blocked. Please enable in browser settings.';
  } else {
    status.innerHTML = '<span class="material-symbols-rounded">info</span> Enable notifications to receive iftar alerts';
  }
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported', 'error');
    return;
  }

  const permission = await Notification.requestPermission();
  updateReminderStatus();

  if (permission === 'granted') {
    showToast('Notifications enabled!', 'success');
    saveReminderSettings();
    scheduleReminders();
  } else {
    showToast('Permission denied', 'error');
  }
}

function updateReminders() {
  saveReminderSettings();
  scheduleReminders();
}

function saveReminderSettings() {
  const settings = {
    r15: document.getElementById('reminder15').checked,
    r30: document.getElementById('reminder30').checked,
    r60: document.getElementById('reminder60').checked,
  };
  localStorage.setItem('iftarReminders', JSON.stringify(settings));
}

function loadReminderSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('iftarReminders') || '{}');
    if (saved.r15) document.getElementById('reminder15').checked = true;
    if (saved.r30 !== undefined) document.getElementById('reminder30').checked = saved.r30;
    if (saved.r60) document.getElementById('reminder60').checked = true;
  } catch (e) {}
}

function scheduleReminders() {
  // Clear old timers
  reminderTimers.forEach(t => clearTimeout(t));
  reminderTimers = [];

  if (!prayerTimes || !prayerTimes.maghrib) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const settings = {
    r15: document.getElementById('reminder15').checked,
    r30: document.getElementById('reminder30').checked,
    r60: document.getElementById('reminder60').checked,
  };

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const iftarTime = parseTime(prayerTimes.maghrib, today);

  const reminders = [];
  if (settings.r15) reminders.push({ mins: 15, label: '15 minutes' });
  if (settings.r30) reminders.push({ mins: 30, label: '30 minutes' });
  if (settings.r60) reminders.push({ mins: 60, label: '60 minutes' });

  reminders.forEach(r => {
    const alertTime = new Date(iftarTime.getTime() - r.mins * 60 * 1000);
    const delay = alertTime - now;

    if (delay > 0) {
      const timer = setTimeout(() => {
        new Notification('🌙 Iftar Reminder', {
          body: `Iftar is in ${r.label}! (Maghrib: ${prayerTimes.maghrib})`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `iftar-reminder-${r.mins}`,
        });
      }, delay);
      reminderTimers.push(timer);
    }
  });
}

// ===========================================================================
// MULTI-LANGUAGE (i18n)
// ===========================================================================
function loadSavedLanguage() {
  const saved = localStorage.getItem('iftarLang') || 'en';
  document.getElementById('langSelector').value = saved;
  if (saved !== 'en') {
    changeLanguage(saved);
  }
}

async function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('iftarLang', lang);

  // Set text direction for RTL languages
  const rtl = ['ar', 'ur'].includes(lang);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';

  if (lang === 'en') {
    // Load English JSON and apply
    try {
      const res = await fetch('/i18n/en.json');
      if (res.ok) {
        i18nData = await res.json();
        document.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          if (i18nData[key]) el.textContent = i18nData[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
          const key = el.getAttribute('data-i18n-placeholder');
          if (i18nData[key]) el.placeholder = i18nData[key];
        });
      }
    } catch (e) { console.error('en i18n error:', e); }
    return;
  }

  try {
    const res = await fetch(`/i18n/${lang}.json`);
    if (!res.ok) throw new Error('Language file not found');
    i18nData = await res.json();

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18nData[key]) {
        el.textContent = i18nData[key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (i18nData[key]) {
        el.placeholder = i18nData[key];
      }
    });
  } catch (e) {
    console.error('i18n load error:', e);
  }
}

// ---------------------------------------------------------------------------
// Toast Notifications
// ---------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escChat(str) {
  if (!str) return '';
  return esc(str).replace(/\n/g, '<br>');
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ---------------------------------------------------------------------------
// Leaflet Map Picker (Add Place Modal)
// ---------------------------------------------------------------------------
let mapPicker = null;
let mapMarker = null;

function initMapPicker() {
  setTimeout(() => {
    const container = document.getElementById('mapPicker');
    if (!container) return;

    if (mapPicker) {
      mapPicker.invalidateSize();
      return;
    }

    const lat = parseFloat(document.getElementById('mosqueLat').value) || userLat || 23.8;
    const lng = parseFloat(document.getElementById('mosqueLng').value) || userLng || 90.4;

    mapPicker = L.map('mapPicker', {
      center: [lat, lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapPicker);

    if (document.getElementById('mosqueLat').value) {
      setMapPin(lat, lng);
    }

    mapPicker.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setMapPin(lat, lng);
      document.getElementById('mosqueLat').value = lat.toFixed(6);
      document.getElementById('mosqueLng').value = lng.toFixed(6);
    });
  }, 200);
}

function setMapPin(lat, lng) {
  if (mapMarker) {
    mapMarker.setLatLng([lat, lng]);
  } else if (mapPicker) {
    mapMarker = L.marker([lat, lng]).addTo(mapPicker);
  }
  const coordsEl = document.getElementById('mapCoords');
  coordsEl.textContent = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  coordsEl.classList.add('has-pin');
}
