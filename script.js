const textTop = document.getElementById("TOTD");
const textBottom = document.querySelector(".bottom");
const displayTime = document.getElementById("displaytime");
const powerInDisplay = document.getElementById("powerin");
const powerOutDisplay = document.getElementById("powerout");
const stateOfChargeDisplay = document.getElementById("stateofcharge");
const center = document.getElementById("center"); // ✅ NEW

const heroVideo = document.querySelector("video");
// Upstream must stay HTTP. On HTTPS pages we can only reach it via HTTPS proxies.
const SOURCE_DATA_URL = "http://jelle.bike:4000/";
const PROXY_URLS = [
  `https://api.allorigins.win/raw?url=${encodeURIComponent(SOURCE_DATA_URL)}`,
  `https://corsproxy.io/?${encodeURIComponent(SOURCE_DATA_URL)}`,
  `https://thingproxy.freeboard.io/fetch/${SOURCE_DATA_URL}`
];
const FETCH_TIMEOUT_MS = 7000;

function getDataUrlCandidates() {
  const isHttpsPage = window.location.protocol === "https:";

  if (isHttpsPage) {
    // Never include plain HTTP when the page itself is HTTPS.
    return PROXY_URLS;
  }

  return [SOURCE_DATA_URL, ...PROXY_URLS];
}

const DATA_URL_CANDIDATES = getDataUrlCandidates();
const DATA_POLL_MS = 10000;

let lastPowerFetchAt = 0;

function tryPlayVideo() {
  if (!heroVideo) return;

  // Ensure autoplay policy requirements are met before playing.
  heroVideo.muted = true;
  heroVideo.playsInline = true;

  const playAttempt = heroVideo.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      // Autoplay can still be blocked (e.g. Low Power Mode on iOS).
    });
  }
}

document.addEventListener("DOMContentLoaded", tryPlayVideo);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") tryPlayVideo();
});

["touchstart", "click"].forEach((eventName) => {
  document.addEventListener(eventName, tryPlayVideo, { once: true });
});

let mouseTargetX = 0;
let mouseX = 0;

let isLive = false;

window.addEventListener("mousemove", (e) => {
  mouseTargetX = (e.clientX / window.innerWidth) * 2 - 1;
});

function getTimeAngleFromDate(date) {
  const seconds =
    date.getHours() * 3600 +
    date.getMinutes() * 60 +
    date.getSeconds() +
    date.getMilliseconds() / 1000;

  const daySeconds = 24 * 3600;

  return (seconds / daySeconds) * Math.PI * 2;
}

function getSunPosition(angle) {
  return {
    x: Math.cos(angle) * 100,
    y: Math.sin(angle) * -100
  };
}

function getTotd(angle) {
  return (1 + Math.sin(angle)) / 2 * 1000;
}

function getScrollValue() {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;

  if (docHeight <= 0) return 350;

  let p = scrollTop / docHeight;
  p = Math.max(0, Math.min(1, p));

  return (0.3 + p * 0.7) * 1000;
}

/* =========================
   🧠 STICKY PROGRESS
========================= */

function getStickyProgress() {
  const rect = center.getBoundingClientRect(); // ✅ use wrapper
  const viewportHeight = window.innerHeight;

  const centerTrigger = viewportHeight / 2;
  const topTrigger = 0;

  let p = (centerTrigger - rect.top) / (centerTrigger - topTrigger);

  // delay start
  p = (p - 0.2) / 0.8;

  p = Math.max(0, Math.min(1, p));

  // easing
  p = p * p * (3 - 2 * p);

  return p;
}

let shadowX = 0;
let shadowY = 0;
let hasStartedScrolling = false;

function applyState(angle, totdValue, radius) {
  const sun = getSunPosition(angle);
  const isScrolled = window.scrollY > 0;

  const isMobile = window.innerWidth < 768;

  const baseDistance = isMobile ? 15 : 40;
  const maxDistance = isMobile ? 40 : 100;
  const scrollStrength = isMobile ? 0.1 : 0.25;

  let normalized = radius / 1000;
  normalized = Math.max(0, Math.min(1, normalized));

  const distance =
    baseDistance +
    (maxDistance - baseDistance) * (0.3 + normalized * scrollStrength);

  const targetX = sun.x * (distance / 120);
  const targetY = sun.y * (distance / 120);

  const lag = 0.08;

  mouseX += (mouseTargetX - mouseX) * lag;

  if (hasStartedScrolling) {
    // Skip the shadow easing once the user starts scrolling.
    shadowX = targetX;
    shadowY = targetY;
  } else {
    shadowX += (targetX - shadowX) * lag;
    shadowY += (targetY - shadowY) * lag;
  }

  /* =========================
     ✨ SCALE WHOLE WRAPPER
  ========================= */

  let scale = 1;

  {
    const p = getStickyProgress();
    const initialScrollKick = isScrolled ? (isMobile ? 0.06 : 0.1) : 0;
    const scrollScaleStrength = isMobile ? 0.48 : 0.62;
    const minScale = isMobile ? 0.5 : 0.35;

    scale = 1 - initialScrollKick - p * scrollScaleStrength;
    scale = Math.max(minScale, Math.min(1, scale));
  }

  // ✅ apply scale ONLY here
  center.style.transform = `scale(${scale})`;

  // ✅ keep translate only for shadow layer
  textBottom.style.transform = `
    translate(${shadowX}px, ${shadowY}px)
  `;

  const style = `'TOTD' ${totdValue}, 'DIST' ${radius}, 'slnt' 15`;

  textTop.style.fontVariationSettings = `'TOTD' ${totdValue}, 'DIST' 0, 'slnt' 15`;
  textBottom.style.fontVariationSettings = style;
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();

  return (h < 10 ? " " + h : h) + ":" + (m < 10 ? "0" + m : m);
}

function formatClock(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

function formatWatts(value) {
  if (!Number.isFinite(value)) return "--";

  return `${Math.round(value).toLocaleString("nl-NL")} W`;
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return "--%";

  return `${value.toFixed(1).replace(".", ",")}%`;
}

function parsePowerPayload(rawText) {
  if (!rawText || typeof rawText !== "string") return [];

  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1) Try regular JSON first (array of arrays or wrapped object).
  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      if (Array.isArray(parsed[0])) return parsed;
      if (parsed.length >= 3 && typeof parsed[1] === "string") return [parsed];
    }

    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {
    // 2) Fall through to tolerant tuple extraction.
  }

  // 2) Tolerant parse for payloads like:
  // [ts,"PowerIn",123], [ts,"PowerOut",456], ... (optionally with trailing comma)
  const matches = trimmed.match(/\[[^\[\]]*\]/g);
  if (!matches) return [];

  const rows = [];

  for (const part of matches) {
    try {
      const row = JSON.parse(part);
      if (Array.isArray(row) && row.length >= 3) {
        rows.push(row);
      }
    } catch {
      // Ignore malformed rows and continue.
    }
  }

  return rows;
}

function readLatestMetrics(rows) {
  if (!Array.isArray(rows)) return null;

  let latestIn = null;
  let latestOut = null;
  let latestStateOfCharge = null;

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3) continue;

    const [epochRaw, typeRaw, valueRaw] = row;
    const epoch = Number(epochRaw);
    const value = Number(valueRaw);
    const type = String(typeRaw);

    if (!Number.isFinite(epoch) || !Number.isFinite(value)) continue;

    if (type === "PowerIn") {
      if (!latestIn || epoch >= latestIn.epoch) {
        latestIn = { epoch, value };
      }
    }

    if (type === "PowerOut") {
      if (!latestOut || epoch >= latestOut.epoch) {
        latestOut = { epoch, value };
      }
    }

    if (type === "StateOfCharge") {
      if (!latestStateOfCharge || epoch >= latestStateOfCharge.epoch) {
        latestStateOfCharge = { epoch, value };
      }
    }
  }

  if (!latestIn && !latestOut && !latestStateOfCharge) return null;

  return { latestIn, latestOut, latestStateOfCharge };
}

function renderPowerData(latestMetrics) {
  if (!latestMetrics) return;

  const { latestIn, latestOut, latestStateOfCharge } = latestMetrics;

  if (latestIn) {
    powerInDisplay.textContent = formatWatts(latestIn.value);
  }

  if (latestOut) {
    powerOutDisplay.textContent = formatWatts(latestOut.value);
  }

  if (latestStateOfCharge) {
    stateOfChargeDisplay.textContent = formatPercentage(latestStateOfCharge.value);
  }
}

async function fetchTextWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return null;

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAndRenderPowerData() {
  const now = Date.now();
  if (now - lastPowerFetchAt < 1500) return;
  lastPowerFetchAt = now;

  for (const url of DATA_URL_CANDIDATES) {
    try {
      const cacheBuster = `sep=${Date.now()}`;
      const urlWithCacheBuster = url.includes("?") ? `${url}&${cacheBuster}` : `${url}?${cacheBuster}`;
      const rawText = await fetchTextWithTimeout(urlWithCacheBuster, FETCH_TIMEOUT_MS);
      if (!rawText) continue;

      const rows = parsePowerPayload(rawText);
      const latestMetrics = readLatestMetrics(rows);
      if (!latestMetrics) continue;

      renderPowerData(latestMetrics);
      return;
    } catch {
      // Try next URL candidate.
    }
  }

  // Keep existing values when all endpoints are temporarily unreachable.
}

/* =========================
   🎬 LOADER
========================= */

function runLoader() {
  const duration = 4000;
  const start = performance.now();

  const targetAngle = getTimeAngleFromDate(new Date());

  function animate(now) {
    let p = (now - start) / duration;
    if (p > 1) p = 1;

    const eased = p * p * (3 - 2 * p);

    const angle =
      targetAngle - Math.PI * 2 + eased * Math.PI * 2;

    const totd = getTotd(angle);
    const radius = 150 + eased * 100;

    applyState(angle, totd, radius);

    const fakeDate = new Date();
    fakeDate.setHours((angle / (2 * Math.PI)) * 24);

    displayTime.innerHTML = formatTime(fakeDate);

    if (p < 1) {
      requestAnimationFrame(animate);
    } else {
      startLive();
    }
  }

  requestAnimationFrame(animate);
}

function startLive() {
  isLive = true;

  function update() {
    if (!hasStartedScrolling && window.scrollY > 0) {
      hasStartedScrolling = true;
    }

    const now = new Date();

    const angle = getTimeAngleFromDate(now);
    const totd = getTotd(angle);
    const radius = getScrollValue();

    applyState(angle, totd, radius);

    displayTime.innerHTML = formatTime(now);
  }

  update();
  fetchAndRenderPowerData();

  setInterval(update, 1000);
  setInterval(fetchAndRenderPowerData, DATA_POLL_MS);
  window.addEventListener("scroll", update);
}

runLoader();

/* =========================
   🪟 POPUP
========================= */

const overlay = document.getElementById("popup-overlay");
const popupContent = document.getElementById("popup-content");
const popupClose = document.getElementById("popup-close");

document.querySelectorAll(".programma-item .button").forEach((btn) => {
  if (btn.tagName === "A") return;
  btn.addEventListener("click", () => {
    const item = btn.closest(".programma-item");
    const img = item.querySelector("img");
    const caption = item.querySelector(".caption");
    const h3 = item.querySelector("h3");
    const ps = item.querySelectorAll(":scope > p");
    const meerInfo = item.querySelector(".meer-info");
    const aanmeldBtn = item.querySelector(".buttons a.button");

    let html = "";
    if (img) html += `<img src="${img.src}" alt="" />`;
    if (h3) html += `<h3>${h3.innerHTML}</h3>`;
    ps.forEach((p) => { html += p.outerHTML; });
    if (meerInfo) html += `<div class="meer-info">${meerInfo.innerHTML}</div>`;
    if (aanmeldBtn) html += `<div class="popup-buttons">${aanmeldBtn.outerHTML}</div>`;

    popupContent.innerHTML = html;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  });
});

popupClose.addEventListener("click", closePopup);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closePopup();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePopup();
});

function closePopup() {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}