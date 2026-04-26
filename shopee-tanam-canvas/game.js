const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const els = {
  coins: document.getElementById("coinText"),
  gems: document.getElementById("gemText"),
  level: document.getElementById("levelText"),
  seeds: document.getElementById("seedText"),
  water: document.getElementById("waterText"),
  fert: document.getElementById("fertText"),
  xp: document.getElementById("xpText"),
  seedName: document.getElementById("seedNameText"),
  seedShop: document.getElementById("seedShop"),
  questList: document.getElementById("questList"),
  xpFill: document.getElementById("xpFill"),
  toast: document.getElementById("toast"),
  startScreen: document.getElementById("startScreen"),
};

const cropTime = 18000;
const seedTypes = [
  { id: "carrot", name: "Wortel", icon: "🥕", minutes: 3, reward: 42, price: 25, amount: 5 },
  { id: "corn", name: "Jagung", icon: "🌽", minutes: 5, reward: 70, price: 45, amount: 4 },
  { id: "tomato", name: "Tomat", icon: "🍅", minutes: 7, reward: 105, price: 70, amount: 3 },
  { id: "berry", name: "Stroberi", icon: "🍓", minutes: 9, reward: 150, price: 110, amount: 3 },
  { id: "grape", name: "Anggur Premium", icon: "🍇", minutes: 12, reward: 230, price: 170, amount: 2 },
  { id: "melon", name: "Melon Emas", icon: "🍈", minutes: 15, reward: 340, price: 250, amount: 1 },
];
const seedById = Object.fromEntries(seedTypes.map((seed) => [seed.id, seed]));
const saveKey = "kebun-hadiah-canvas-v1";
const questActions = {
  plant: "plant",
  harvest: "harvest",
  water: "water",
  fertilize: "fertilize",
  buySeed: "buySeed",
};
let selectedTool = "seed";
let selectedSeedType = "carrot";
let last = performance.now();
let particles = [];
let floaters = [];
let started = false;
let muted = false;

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}
function imageReady(img) {
  return img.complete && img.naturalWidth > 0;
}
const art = {
  gameplayBg: {
    morning: loadImage("assets/gameplay-bg-morning.png"),
    day: loadImage("assets/gameplay-bg-day.png"),
    evening: loadImage("assets/gameplay-bg-evening.png"),
    night: loadImage("assets/gameplay-bg-night.png"),
  },
  groundShadow: loadImage("assets/sprites/ground-shadow.png"),
  plotEmpty: loadImage("assets/sprites/plot-empty.png"),
  plotWatered: loadImage("assets/sprites/plot-watered.png"),
  plotFertilized: loadImage("assets/sprites/plot-fertilized.png"),
  mascot: loadImage("assets/sprites/mascot.png"),
  waterSplash: loadImage("assets/sprites/water-splash.png"),
  sparkleBurst: loadImage("assets/sprites/sparkle-burst.png"),
  coinPop: loadImage("assets/sprites/coin-pop.png"),
  cropStages: Object.fromEntries(
    ["carrot", "corn", "tomato", "berry", "grape", "melon"].map((crop) => [
      crop,
      ["seed", "small", "medium", "large", "fruit"].map((stage) =>
        loadImage(`assets/sprites/crop-${crop}-${stage}.png`),
      ),
    ]),
  ),
};
function timeScene(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 16) return "day";
  if (hour >= 16 && hour < 19) return "evening";
  return "night";
}
function currentGameplayBg() {
  const scene = timeScene();
  return art.gameplayBg[scene] || art.gameplayBg.day;
}
function drawSprite(img, x, y, w, h, alpha = 1, anchor = "bottom") {
  if (!imageReady(img)) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const dx = x - w / 2;
  const dy = anchor === "center" ? y - h / 2 : y - h;
  ctx.drawImage(img, dx, dy, w, h);
  ctx.restore();
  return true;
}

const defaultState = () => ({
  coins: 120,
  gems: 8,
  level: 1,
  xp: 0,
  seeds: 6,
  seedInventory: { carrot: 6 },
  selectedSeedType: "carrot",
  water: 4,
  fertilizer: 2,
  questRewardClaimed: false,
  questDay: "",
  questBatch: 0,
  dailyQuests: [],
  giftClaimedAt: 0,
  quests: { harvest: 0, water: 0, fert: 0 },
  plots: Array.from({ length: 6 }, (_, i) => ({
    id: i,
    plantedAt: 0,
    watered: 0,
    fertilized: 0,
    bounce: 0,
  })),
});

let state = load();
const plotPos = [
  { x: 118, y: 363 },
  { x: 270, y: 364 },
  { x: 116, y: 457 },
  { x: 274, y: 461 },
  { x: 114, y: 565 },
  { x: 281, y: 563 },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
    const next = {
      ...defaultState(),
      ...saved,
    };
    next.seedInventory = {
      carrot: saved.seedInventory?.carrot ?? saved.seeds ?? next.seeds,
      corn: saved.seedInventory?.corn ?? 0,
      tomato: saved.seedInventory?.tomato ?? 0,
      berry: saved.seedInventory?.berry ?? 0,
      grape: saved.seedInventory?.grape ?? 0,
      melon: saved.seedInventory?.melon ?? 0,
    };
    next.selectedSeedType = seedById[saved.selectedSeedType] ? saved.selectedSeedType : "carrot";
    next.dailyQuests = Array.isArray(saved.dailyQuests) ? saved.dailyQuests : [];
    next.questBatch = Number.isFinite(saved.questBatch) ? saved.questBatch : 0;
    next.questDay = saved.questDay || "";
    selectedSeedType = next.selectedSeedType;
    return next;
  } catch {
    return defaultState();
  }
}
function save() {
  localStorage.setItem(saveKey, JSON.stringify(state));
}
function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRandom(seed) {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function makeQuestPool(rand) {
  const pickSeed = () => seedTypes[Math.floor(rand() * seedTypes.length)];
  const seedA = pickSeed();
  const seedB = pickSeed();
  return [
    { id: "plant-any", action: questActions.plant, label: "Tanam {target} benih apa saja", target: 3 + Math.floor(rand() * 3), coins: 55, gems: 0 },
    { id: "harvest-any", action: questActions.harvest, label: "Panen {target} tanaman", target: 2 + Math.floor(rand() * 3), coins: 80, gems: 1 },
    { id: "water-any", action: questActions.water, label: "Siram tanaman {target} kali", target: 4 + Math.floor(rand() * 4), coins: 45, gems: 0 },
    { id: "fert-any", action: questActions.fertilize, label: "Pakai pupuk {target} kali", target: 1 + Math.floor(rand() * 3), coins: 70, gems: 0 },
    { id: `plant-${seedA.id}`, action: questActions.plant, seedId: seedA.id, label: `Tanam ${seedA.name} {target} kali`, target: 1 + Math.floor(rand() * 2), coins: 75, gems: 1 },
    { id: `harvest-${seedB.id}`, action: questActions.harvest, seedId: seedB.id, label: `Panen ${seedB.name} {target} kali`, target: 1 + Math.floor(rand() * 2), coins: 95, gems: 1 },
    { id: "buy-seed", action: questActions.buySeed, label: "Beli benih di toko {target} kali", target: 1 + Math.floor(rand() * 2), coins: 50, gems: 0 },
  ];
}
function generateDailyQuests(batch = 0) {
  const today = dayKey();
  const rand = seededRandom(hashString(`${today}:${batch}:${state.level}`));
  const pool = makeQuestPool(rand);
  const picked = [];
  while (pool.length && picked.length < 3) {
    const idx = Math.floor(rand() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((quest, index) => ({
    ...quest,
    key: `${today}-${batch}-${index}-${quest.id}`,
    progress: 0,
    target: Math.max(1, quest.target),
  }));
}
function ensureDailyQuests() {
  const today = dayKey();
  if (state.questDay !== today || !Array.isArray(state.dailyQuests) || state.dailyQuests.length === 0) {
    state.questDay = today;
    state.questBatch = 0;
    state.questRewardClaimed = false;
    state.dailyQuests = generateDailyQuests(0);
  }
}
function questLabel(quest) {
  return quest.label.replace("{target}", quest.target);
}
function questDone(quest) {
  return quest.progress >= quest.target;
}
function questRewardText() {
  ensureDailyQuests();
  const coins = state.dailyQuests.reduce((sum, quest) => sum + quest.coins, 0);
  const gems = state.dailyQuests.reduce((sum, quest) => sum + quest.gems, 0);
  return gems ? `Klaim +${coins} Koin +${gems} Permata` : `Klaim +${coins} Koin`;
}
function renderQuests() {
  ensureDailyQuests();
  if (!els.questList) return;
  const html = state.dailyQuests
    .map((quest) => {
      const progress = Math.min(quest.progress, quest.target);
      const done = questDone(quest) ? " done" : "";
      return `<div class="quest${done}"><span>${questLabel(quest)}</span><b>${progress}/${quest.target}</b></div>`;
    })
    .join("");
  if (els.questList.innerHTML !== html) els.questList.innerHTML = html;
  const claimBtn = document.getElementById("claimQuest");
  if (claimBtn) {
    const text = state.dailyQuests.every(questDone) ? questRewardText() : "Selesaikan semua misi";
    if (claimBtn.textContent !== text) claimBtn.textContent = text;
  }
}
function advanceQuests(action, payload = {}) {
  ensureDailyQuests();
  let changed = false;
  state.dailyQuests.forEach((quest) => {
    if (questDone(quest) || quest.action !== action) return;
    if (quest.seedId && quest.seedId !== payload.seedId) return;
    quest.progress = Math.min(quest.target, quest.progress + (payload.amount || 1));
    changed = true;
  });
  if (changed) renderQuests();
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function ease(t) {
  return 1 - Math.pow(1 - t, 3);
}
function harvestTime(plot) {
  return plot.harvestAt || plot.plantedAt + cropTime;
}
function harvestLabel(plot) {
  return new Date(harvestTime(plot)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function countdownLabel(plot) {
  const remaining = Math.max(harvestTime(plot) - Date.now(), 0);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function growth(plot) {
  if (!plot.plantedAt) return 0;
  const boost = 1 + plot.watered * 0.23 + plot.fertilized * 0.38;
  return clamp(((Date.now() - plot.plantedAt) / (harvestTime(plot) - plot.plantedAt)) * boost, 0, 1);
}
function stage(plot) {
  return Math.floor(growth(plot) * 4.999);
}
function visualActive(until) {
  return until && Date.now() < until;
}
function getSeed(id) {
  return seedById[id] || seedTypes[0];
}
function selectedSeed() {
  return getSeed(selectedSeedType);
}

function updateHUD() {
  els.coins.textContent = state.coins;
  els.gems.textContent = state.gems;
  els.level.textContent = state.level;
  const activeSeed = selectedSeed();
  els.seeds.textContent = state.seedInventory[activeSeed.id] || 0;
  els.seedName.textContent = activeSeed.name;
  els.water.textContent = state.water;
  els.fert.textContent = state.fertilizer;
  const need = 120 + (state.level - 1) * 55;
  els.xp.textContent = `${state.xp}/${need}`;
  els.xpFill.style.width = `${clamp((state.xp / need) * 100, 0, 100)}%`;
  renderQuests();
  document.querySelectorAll("[data-seed-stock]").forEach((el) => {
    el.textContent = `Stok ${state.seedInventory[el.dataset.seedStock] || 0}`;
  });
  document.querySelectorAll("[data-select-seed]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.selectSeed === activeSeed.id);
  });
}
function renderSeedShop() {
  els.seedShop.innerHTML = seedTypes
    .map(
      (seed) => `
        <div class="buy-card seed-card" data-select-seed="${seed.id}">
          <span class="seed-emoji">${seed.icon}</span>
          <span class="seed-info">
            <b>${seed.name}</b>
            <small>${seed.minutes} menit • panen ${seed.reward} koin</small>
          </span>
          <span class="seed-price">
            <em>${seed.price} koin</em>
            <i data-seed-stock="${seed.id}">Stok ${state.seedInventory[seed.id] || 0}</i>
          </span>
          <span class="seed-actions">
            <button class="seed-select" data-pick-seed="${seed.id}">Pilih</button>
            <button class="seed-buy" data-buy-seed="${seed.id}">Beli +${seed.amount}</button>
          </span>
        </div>
      `,
    )
    .join("");
}
function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.add("hidden"), 1650);
}
function addXP(n) {
  state.xp += n;
  const need = 120 + (state.level - 1) * 55;
  if (state.xp >= need) {
    state.xp -= need;
    state.level++;
    state.gems += 2;
    toast("Level naik! +2 permata");
    burst(195, 260, "#ffe45c", 34);
  }
}
function sound(freq = 440, dur = 0.06) {
  if (muted) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  sound.ctx ||= new AudioCtx();
  const o = sound.ctx.createOscillator(),
    g = sound.ctx.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.value = 0.035;
  o.connect(g);
  g.connect(sound.ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, sound.ctx.currentTime + dur);
  o.stop(sound.ctx.currentTime + dur);
}

function draw() {
  const t = performance.now() / 1000;
  const bg = currentGameplayBg();
  if (imageReady(bg)) ctx.drawImage(bg, 0, 0, W, H);
  else {
    drawSky(t);
    drawGarden(t);
  }
  drawAmbientSprites(t);
  drawPlots(t);
  drawMascot(t);
  drawParticles();
  drawFloaters();
}
function ellipse(x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}
function roundRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#8beaff");
  g.addColorStop(0.42, "#c8ff9d");
  g.addColorStop(1, "#72d257");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ellipse(320, 88, 46 + Math.sin(t) * 2, 46, "#ffdf4e");
  ellipse(320, 88, 31, 31, "#fff095");
  drawCloud(68 + Math.sin(t * 0.35) * 12, 128, 0.85);
  drawCloud(295 - Math.sin(t * 0.28) * 16, 178, 0.65);
  for (let i = 0; i < 24; i++) {
    ellipse(
      ((i * 53 + t * 10) % 430) - 20,
      238 + Math.sin(i + t) * 8,
      2,
      2,
      "rgba(255,255,255,.45)",
    );
  }
}
function drawCloud(x, y, s) {
  ctx.save();
  ctx.scale(s, s);
  x /= s;
  y /= s;
  ellipse(x, y, 34, 16, "rgba(255,255,255,.82)");
  ellipse(x - 23, y + 3, 21, 13, "rgba(255,255,255,.72)");
  ellipse(x + 22, y + 2, 24, 14, "rgba(255,255,255,.76)");
  ctx.restore();
}
function drawGarden(t) {
  ellipse(195, 700, 260, 120, "#44b852");
  ellipse(195, 740, 245, 95, "#38a84b");
  ctx.fillStyle = "rgba(255,255,255,.18)";
  for (let i = 0; i < 16; i++)
    ellipse(
      (i * 37 + 20) % W,
      286 + (i % 5) * 82 + Math.sin(t + i) * 3,
      12,
      3,
      ctx.fillStyle,
    );
  drawFence();
  ctx.fillStyle = "#2f9e49";
  for (let x = -20; x < W + 20; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.quadraticCurveTo(x + 14, 260 + Math.sin(x) * 20, x + 28, 300);
    ctx.fill();
  }
}
function drawFence() {
  ctx.fillStyle = "#ffc46a";
  for (let x = 14; x < W; x += 42) roundRect(x, 265, 14, 80, 5, "#ffc46a");
  roundRect(0, 292, W, 13, 6, "#e79b3c");
  roundRect(0, 325, W, 12, 6, "#d88932");
}
function drawAmbientSprites(t) {
  if (!imageReady(currentGameplayBg())) return;
  ctx.save();
  ctx.globalAlpha = 0.38 + Math.sin(t * 1.4) * 0.04;
  ellipse(318, 95, 46, 46, "rgba(255,240,139,.42)");
  ctx.restore();
}
function drawPlots(t) {
  plotPos.forEach((p, i) => {
    const plot = state.plots[i];
    plot.bounce *= 0.88;
    const b = Math.sin(t * 2 + i) * 2 - plot.bounce;
    const plotArt = plot.fertilized
      ? art.plotFertilized
      : plot.watered
        ? art.plotWatered
        : art.plotEmpty;
    if (imageReady(currentGameplayBg())) {
      if (plot.plantedAt) {
        drawPlantSprite(p.x, p.y + 24 + b, growth(plot), t + i, plot);
        drawHarvestTime(p.x, p.y - 72, plot);
      } else drawSeedHint(p.x, p.y - 4 + b, t + i);
      if (visualActive(plot.waterEffectUntil))
        drawSprite(art.waterSplash, p.x + 30, p.y + 5, 34, 34, 0.52, "center");
      if (visualActive(plot.fertEffectUntil))
        drawSprite(
          art.sparkleBurst,
          p.x,
          p.y + 11,
          84,
          84,
          0.36 + Math.sin(t * 3 + i) * 0.08,
          "center",
        );
    } else if (imageReady(plotArt)) {
      drawSprite(art.groundShadow, p.x, p.y + 40, 132, 62, 0.55, "center");
      drawSprite(plotArt, p.x, p.y + 43 + b, 126, 79, 1);
      if (plot.plantedAt) {
        drawPlantSprite(p.x, p.y + 24 + b, growth(plot), t + i, plot);
        drawHarvestTime(p.x, p.y - 72, plot);
      } else drawSeedHint(p.x, p.y - 4 + b, t + i);
    } else {
      ellipse(p.x, p.y + 26, 64, 29, "rgba(59,45,24,.16)");
      ellipse(p.x, p.y + 18 + b, 56, 31, "#9a5a2d");
      ellipse(p.x, p.y + 12 + b, 50, 24, "#c47a3b");
      if (plot.plantedAt) {
        drawPlant(p.x, p.y + 6 + b, growth(plot), t + i, plot);
        drawHarvestTime(p.x, p.y - 72, plot);
      } else drawSeedHint(p.x, p.y + 1 + b, t + i);
      ellipse(p.x, p.y + 6 + b, 42, 15, "#7a3f20");
      for (let k = 0; k < 8; k++)
        ellipse(
          p.x - 33 + k * 9,
          p.y + 7 + Math.sin(k) * 5 + b,
          3,
          1.8,
          "#5e321d",
        );
    }
  });
}
function drawSeedHint(x, y, t) {
  ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.15;
  ellipse(x, y, 10, 6, "#ffd45a");
  ellipse(x + 7, y - 5, 4, 8, "#47b65a");
  ctx.globalAlpha = 1;
}
function drawHarvestTime(x, y, plot) {
  const progress = growth(plot);
  const w = 76;
  const h = 26;
  ctx.save();
  ctx.translate(x - w / 2, y - h / 2);
  roundRect(0, 0, w, h, 10, "rgba(255,255,255,.82)");
  roundRect(7, 16, w - 14, 5, 4, "rgba(58,42,19,.18)");
  roundRect(7, 16, (w - 14) * progress, 5, 4, progress >= 1 ? "#ffb82e" : "#4fcf62");
  ctx.font = "800 11px Nunito";
  ctx.textAlign = "center";
  ctx.fillStyle = progress >= 1 ? "#b15b00" : "#2c431f";
  ctx.fillText(progress >= 1 ? "Siap panen" : countdownLabel(plot), w / 2, 12);
  ctx.restore();
}
function drawPlantSprite(x, y, g, t, plot) {
  const idx = Math.min(4, Math.floor(g * 4.999));
  const cropSet = art.cropStages[plot.seedType] || art.cropStages.carrot;
  const img = cropSet[idx];
  if (!imageReady(img)) return drawPlant(x, y, g, t, plot);
  const typeScale = { carrot: 1, corn: 1.08, tomato: 1, berry: 0.94, grape: 1.02, melon: 1.04 }[plot.seedType] || 1;
  const size = [42, 54, 72, 92, 108][idx] * typeScale;
  const anchorYOffset = [4, 2, 0, -2, -4][idx];
  const bob = Math.sin(t * 2.2) * (idx > 1 ? 2 : 1);
  drawSprite(img, x, y + anchorYOffset + bob, size, size, 1);
  if (visualActive(plot.waterEffectUntil))
    drawSprite(
      art.waterSplash,
      x + 27,
      y - 22 + Math.sin(t * 3) * 2,
      42,
      42,
      0.7,
      "center",
    );
  if (visualActive(plot.fertEffectUntil))
    drawSprite(
      art.sparkleBurst,
      x,
      y - 38,
      54,
      54,
      0.52 + Math.sin(t * 4) * 0.12,
      "center",
    );
}
function drawPlant(x, y, g, t, plot) {
  const s = 0.35 + ease(g) * 0.95;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = "#1d7c38";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.quadraticCurveTo(Math.sin(t * 2) * 5, -14, 0, -42);
  ctx.stroke();
  leaf(-18, 2, -28, -15, "#38b653");
  leaf(18, -10, 31, -27, "#45c963");
  leaf(-13, -25, -29, -38, "#2fae52");
  leaf(15, -34, 30, -47, "#52d56d");
  if (g > 0.66) {
    const n = g > 0.9 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.3;
      fruit(
        Math.cos(a) * 22,
        -43 + Math.sin(a) * 12,
        8 + Math.sin(t * 3 + i) * 1.2,
      );
    }
  }
  if (visualActive(plot.waterEffectUntil)) droplets(24, 5, t);
  if (visualActive(plot.fertEffectUntil)) sparkleRing(t);
  ctx.restore();
}
function leaf(x1, y1, x2, y2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(
    (x1 + x2) / 2,
    (y1 + y2) / 2,
    18,
    8,
    Math.atan2(y2 - y1, x2 - x1),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath();
  ctx.ellipse(
    (x1 + x2) / 2 - 2,
    (y1 + y2) / 2 - 2,
    8,
    2,
    Math.atan2(y2 - y1, x2 - x1),
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
function fruit(x, y, r) {
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r);
  g.addColorStop(0, "#fff3a2");
  g.addColorStop(0.35, "#ff8b2c");
  g.addColorStop(1, "#df3c22");
  ellipse(x, y, r, r, g);
  ellipse(x - 3, y - 4, 2, 2, "#fff8");
}
function droplets(x, y, t) {
  ctx.fillStyle = "#44c9ff";
  for (let i = 0; i < 3; i++)
    ellipse(x + i * 8, y + Math.sin(t * 4 + i) * 4, 3, 5, "#44c9ff");
}
function sparkleRing(t) {
  ctx.fillStyle = "#fff07a";
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + t;
    ellipse(Math.cos(a) * 38, -18 + Math.sin(a) * 30, 3, 3, "#fff07a");
  }
}
function drawMascot(t) {
  const y = 246 + Math.sin(t * 2.4) * 5;
  if (drawSprite(art.mascot, 58, y + 49, 82, 82, 1)) return;
  ellipse(58, y + 38, 30, 8, "rgba(0,0,0,.12)");
  ellipse(58, y, 26, 30, "#fff2c8");
  ellipse(48, y - 9, 6, 6, "#2b5130");
  ellipse(68, y - 9, 6, 6, "#2b5130");
  ctx.strokeStyle = "#2b5130";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(58, y + 2, 9, 0.2, Math.PI - 0.2);
  ctx.stroke();
  leaf(55, y - 31, 78, y - 49, "#36b851");
  leaf(52, y - 30, 36, y - 49, "#45c760");
}
function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = p.life;
    ellipse(p.x, p.y, p.r, p.r, p.color);
    ctx.globalAlpha = 1;
  });
}
function drawFloaters() {
  ctx.font = "900 17px Nunito";
  floaters.forEach((f) => {
    ctx.globalAlpha = f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  });
}

function burst(x, y, color, count = 18) {
  for (let i = 0; i < count; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.8) * 5,
      r: 2 + Math.random() * 5,
      color,
      life: 1,
    });
}
function floater(text, x, y, color = "#fff") {
  floaters.push({ text, x, y, vy: -1.2, life: 1, color });
}
function tick(now) {
  const dt = Math.min((now - last) / 16.67, 3);
  last = now;
  particles = particles.filter(
    (p) => (
      (p.x += p.vx * dt),
      (p.y += p.vy * dt),
      (p.vy += 0.08 * dt),
      (p.life -= 0.018 * dt),
      p.life > 0
    ),
  );
  floaters = floaters.filter(
    (f) => ((f.y += f.vy * dt), (f.life -= 0.014 * dt), f.life > 0),
  );
  draw();
  updateHUD();
  requestAnimationFrame(tick);
}

function canvasPoint(ev) {
  const r = canvas.getBoundingClientRect();
  const touch = ev.touches ? ev.touches[0] : ev;
  return {
    x: ((touch.clientX - r.left) / r.width) * W,
    y: ((touch.clientY - r.top) / r.height) * H,
  };
}
function handleTap(ev) {
  if (!started) return;
  const m = canvasPoint(ev);
  const hit = plotPos.findIndex((p) => Math.hypot(m.x - p.x, m.y - p.y) < 64);
  if (hit < 0) return;
  const plot = state.plots[hit];
  plot.bounce = 8;
  if (!plot.plantedAt) {
    if (selectedTool !== "seed") return toast("Pilih benih untuk lahan kosong");
    const seed = selectedSeed();
    if ((state.seedInventory[seed.id] || 0) <= 0) return toast(`${seed.name} habis, buka toko`);
    state.seedInventory[seed.id]--;
    state.seeds = state.seedInventory.carrot;
    plot.seedType = seed.id;
    plot.plantedAt = Date.now();
    plot.harvestAt = plot.plantedAt + seed.minutes * 60000;
    plot.watered = 0;
    plot.fertilized = 0;
    plot.waterEffectUntil = 0;
    plot.fertEffectUntil = 0;
    advanceQuests(questActions.plant, { seedId: seed.id });
    sound(520);
    burst(plotPos[hit].x, plotPos[hit].y, "#c8793a", 12);
    floater("Tumbuh!", plotPos[hit].x - 24, plotPos[hit].y - 42, "#17542b");
  } else if (growth(plot) >= 1) {
    const seed = getSeed(plot.seedType);
    const reward = seed.reward + plot.fertilized * 12;
    state.coins += reward;
    state.seedInventory[seed.id] = (state.seedInventory[seed.id] || 0) + (Math.random() > 0.55 ? 1 : 0);
    state.seeds = state.seedInventory.carrot;
    addXP(34);
    state.quests.harvest++;
    advanceQuests(questActions.harvest, { seedId: seed.id });
    burst(plotPos[hit].x, plotPos[hit].y - 45, "#ffd24d", 30);
    floater(`+${reward} Koin`, plotPos[hit].x - 28, plotPos[hit].y - 60, "#fff6a8");
    sound(760, 0.09);
    Object.assign(plot, { plantedAt: 0, harvestAt: 0, seedType: "", watered: 0, fertilized: 0, waterEffectUntil: 0, fertEffectUntil: 0 });
  } else if (selectedTool === "water") {
    if (state.water <= 0) return toast("Air habis, ambil bonus/toko");
    state.water--;
    plot.watered++;
    plot.waterEffectUntil = Date.now() + 1800;
    state.quests.water++;
    advanceQuests(questActions.water);
    burst(plotPos[hit].x + 20, plotPos[hit].y - 55, "#49cfff", 16);
    floater("Segar!", plotPos[hit].x - 20, plotPos[hit].y - 52, "#e8fbff");
    sound(620);
  } else if (selectedTool === "fertilizer") {
    if (state.fertilizer <= 0) return toast("Pupuk habis");
    state.fertilizer--;
    plot.fertilized++;
    plot.fertEffectUntil = Date.now() + 1800;
    state.quests.fert++;
    advanceQuests(questActions.fertilize);
    burst(plotPos[hit].x, plotPos[hit].y - 35, "#fff07a", 22);
    floater("Cepat!", plotPos[hit].x - 19, plotPos[hit].y - 58, "#fff7ad");
    sound(690);
  } else toast("Tunggu matang atau pilih air/pupuk");
  save();
  updateHUD();
}

canvas.addEventListener("pointerdown", handleTap);
document.querySelectorAll(".resource-card").forEach((btn) =>
  btn.addEventListener("click", () => {
    selectedTool = btn.dataset.tool;
    document
      .querySelectorAll(".resource-card")
      .forEach((b) => b.classList.toggle("active", b === btn));
    sound(420, 0.04);
  }),
);
document
  .querySelectorAll("[data-panel]")
  .forEach((btn) =>
    btn.addEventListener("click", () => openSheet(btn.dataset.panel)),
  );
document
  .querySelectorAll(".close-sheet")
  .forEach((btn) => btn.addEventListener("click", closeSheets));
document.getElementById("homeBtn").addEventListener("click", closeSheets);
document.querySelector(".sheet").addEventListener("click", (ev) => {
  const pickBtn = ev.target.closest("[data-pick-seed]");
  if (pickBtn) return pickSeed(pickBtn.dataset.pickSeed);
  const seedBtn = ev.target.closest("[data-buy-seed]");
  if (seedBtn) return buySeed(seedBtn.dataset.buySeed);
  const itemBtn = ev.target.closest("[data-buy]");
  if (itemBtn) buy(itemBtn.dataset.buy);
});
document.getElementById("startBtn").addEventListener("click", () => {
  started = true;
  els.startScreen.classList.add("hidden");
  toast("Tap lahan untuk menanam");
  sound(540);
});
document.getElementById("soundBtn").addEventListener("click", () => {
  muted = !muted;
  document.getElementById("soundBtn").textContent = muted ? "×" : "♪";
});
document.getElementById("claimGift").addEventListener("click", claimGift);
document.getElementById("claimQuest").addEventListener("click", claimQuest);

function setActiveNav(panelId = null) {
  document.querySelectorAll(".bottom-dock button").forEach((btn) => {
    btn.classList.toggle(
      "active",
      panelId ? btn.dataset.panel === panelId : btn.id === "homeBtn",
    );
  });
}
function openSheet(id) {
  closeSheets(false);
  document.getElementById(id).classList.remove("hidden");
  setActiveNav(id);
  sound(360, 0.04);
}
function closeSheets(resetNav = true) {
  document.querySelectorAll(".sheet").forEach((s) => s.classList.add("hidden"));
  if (resetNav) setActiveNav();
}
function pickSeed(id) {
  const seed = getSeed(id);
  if ((state.seedInventory[seed.id] || 0) <= 0) return toast(`${seed.name} belum punya stok`);
  selectedSeedType = seed.id;
  state.selectedSeedType = seed.id;
  selectedTool = "seed";
  document
    .querySelectorAll(".resource-card")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === "seed"));
  toast(`${seed.name} dipilih untuk ditanam`);
  sound(520, 0.04);
  save();
  updateHUD();
}
function buySeed(id) {
  const seed = getSeed(id);
  if (state.coins < seed.price) return toast("Koin belum cukup");
  state.coins -= seed.price;
  state.seedInventory[seed.id] = (state.seedInventory[seed.id] || 0) + seed.amount;
  state.seeds = state.seedInventory.carrot;
  advanceQuests(questActions.buySeed, { seedId: seed.id });
  toast(`${seed.name} +${seed.amount} masuk tas`);
  burst(195, 680, "#ffd24d", 12);
  sound(800, 0.05);
  save();
  updateHUD();
}
function buy(type) {
  const prices = { water: 35, fertilizer: 50 };
  if (state.coins < prices[type]) return toast("Koin belum cukup");
  state.coins -= prices[type];
  if (type === "water") state.water += 5;
  if (type === "fertilizer") state.fertilizer += 3;
  toast("Item masuk tas");
  burst(195, 680, "#ffd24d", 12);
  sound(800, 0.05);
  save();
  updateHUD();
}
function claimGift() {
  const today = new Date().toDateString();
  if (state.giftClaimedAt === today)
    return toast("Bonus sudah diklaim hari ini");
  state.giftClaimedAt = today;
  state.coins += 80;
  state.water += 2;
  toast("Bonus diterima!");
  burst(195, 430, "#ffdd48", 36);
  save();
  updateHUD();
}
function claimQuest() {
  ensureDailyQuests();
  if (state.dailyQuests.every(questDone)) {
    const coins = state.dailyQuests.reduce((sum, quest) => sum + quest.coins, 0);
    const gems = state.dailyQuests.reduce((sum, quest) => sum + quest.gems, 0);
    state.coins += coins;
    state.gems += gems;
    state.questBatch++;
    state.questRewardClaimed = false;
    state.dailyQuests = generateDailyQuests(state.questBatch);
    toast(gems ? `Misi selesai! +${coins} koin +${gems} permata` : `Misi selesai! +${coins} koin`);
    burst(195, 430, "#fff070", 42);
    save();
    updateHUD();
    renderQuests();
  } else toast("Selesaikan semua misi dulu");
}

ensureDailyQuests();
renderSeedShop();
updateHUD();
requestAnimationFrame(tick);
setInterval(save, 3000);
