const textTop = document.getElementById("TOTD");
const textBottom = document.querySelector(".bottom");
const displayTime = document.getElementById("displaytime");
const center = document.getElementById("center"); // ✅ NEW

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

function applyState(angle, totdValue, radius) {
  const sun = getSunPosition(angle);

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

  shadowX += (targetX - shadowX) * lag;
  shadowY += (targetY - shadowY) * lag;

  /* =========================
     ✨ SCALE WHOLE WRAPPER
  ========================= */

  let scale = 1;

  if (isLive) {
    const p = getStickyProgress();

    scale = 1 - p * 0.5;
    scale = Math.max(0.5, Math.min(1, scale));
  }

  // ✅ apply scale ONLY here
  center.style.transform = `scale(${scale})`;

  // ✅ keep translate only for shadow layer
  textBottom.style.transform = `
    translate(${shadowX}px, ${shadowY}px)
  `;

  const style = `'TOTD' ${totdValue}, 'DIST' ${radius}, 'slnt' 40`;

  textTop.style.fontVariationSettings = `'TOTD' ${totdValue}, 'DIST' 0, 'slnt' 40`;
  textBottom.style.fontVariationSettings = style;
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();

  return (h < 10 ? " " + h : h) + ":" + (m < 10 ? "0" + m : m);
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
    const now = new Date();

    const angle = getTimeAngleFromDate(now);
    const totd = getTotd(angle);
    const radius = getScrollValue();

    applyState(angle, totd, radius);

    displayTime.innerHTML = formatTime(now);
  }

  update();

  setInterval(update, 1000);
  window.addEventListener("scroll", update);
}

runLoader();