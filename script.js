const textTop = document.getElementById("TOTD");
const textBottom = document.querySelector(".bottom");
const displayTime = document.getElementById("displaytime");

/* =========================
   🖱️ MOUSE INPUT
========================= */

let mouseTargetX = 0;
let mouseX = 0;

window.addEventListener("mousemove", (e) => {
  mouseTargetX = (e.clientX / window.innerWidth) * 2 - 1;
});

/* =========================
   🧠 TIME → ANGLE
========================= */

function getTimeAngleFromDate(date) {
  const seconds =
    date.getHours() * 3600 +
    date.getMinutes() * 60 +
    date.getSeconds() +
    date.getMilliseconds() / 1000;

  const daySeconds = 24 * 3600;

  return (seconds / daySeconds) * Math.PI * 2;
}

/* =========================
   ☀️ SUN POSITION
========================= */

function getSunPosition(angle) {
  return {
    x: Math.cos(angle) * 100,
    y: Math.sin(angle) * -100
  };
}

/* =========================
   🎯 TOTD VALUE
========================= */

function getTotd(angle) {
  return (1 + Math.sin(angle)) / 2 * 1000;
}

/* =========================
   📉 SCROLL → DISTANCE
========================= */

function getScrollValue() {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;

  if (docHeight <= 0) return 350;

  let p = scrollTop / docHeight;
  p = Math.max(0, Math.min(1, p));

  return (0.3 + p * 0.7) * 1000;
}

/* =========================
   🪶 SMOOTH STATE
========================= */

let shadowX = 0;
let shadowY = 0;
let currentSlant = 0;

/* =========================
   🎨 APPLY STATE
========================= */

function applyState(angle, totdValue, radius) {
  const sun = getSunPosition(angle);

  const baseDistance = 40;
  const maxDistance = 100;
  const scrollStrength = 0.25;

  let normalized = radius / 1000;
  normalized = Math.max(0, Math.min(1, normalized));

  const distance =
    baseDistance +
    (maxDistance - baseDistance) * (0.3 + normalized * scrollStrength);

  const targetX = sun.x * (distance / 120);
  const targetY = sun.y * (distance / 120);

  /* =========================
     🖱️ SMOOTH MOUSE
  ========================= */

  const lag = 0.08;

  mouseX += (mouseTargetX - mouseX) * lag;

  const maxSlant = 12;
  const targetSlant = mouseX * maxSlant;

  /* =========================
     🪶 SMOOTH SHADOW
  ========================= */

  shadowX += (targetX - shadowX) * lag;
  shadowY += (targetY - shadowY) * lag;
  currentSlant += (targetSlant - currentSlant) * lag;

  /* =========================
     🎨 APPLY
  ========================= */

  const commonTransform = `skewX(${currentSlant * 0.25}deg)`;

  textTop.style.transform = commonTransform;

  textBottom.style.transform = `
    translate(${shadowX}px, ${shadowY}px)
    ${commonTransform}
  `;

  const style = `'TOTD' ${totdValue}, 'DIST' ${radius}, 'slnt' ${currentSlant}`;

  textTop.style.fontVariationSettings = `'TOTD' ${totdValue}, 'DIST' 0, 'slnt' ${currentSlant}`;
  textBottom.style.fontVariationSettings = style;
}

/* =========================
   🧮 TIME DISPLAY
========================= */

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();

  return (h < 10 ? " " + h : h) + ":" + (m < 10 ? "0" + m : m);
}

/* =========================
   🎬 LOADER (FULL DAY LOOP)
========================= */

function runLoader() {
  const duration = 4000;
  const start = performance.now();

  const targetAngle = getTimeAngleFromDate(new Date());

  function animate(now) {
    let p = (now - start) / duration;
    if (p > 1) p = 1;

    const eased = p * p * (3 - 2 * p);

    // 🔁 full loop: previous day → current time
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

/* =========================
   🚀 LIVE MODE
========================= */

function startLive() {
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

/* =========================
   ▶️ START
========================= */

runLoader();