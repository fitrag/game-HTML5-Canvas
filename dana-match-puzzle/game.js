const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const els = {
  balance: document.getElementById("balanceText"),
  topBalance: document.getElementById("topBalanceText"),
  coins: document.getElementById("coinText"),
  level: document.getElementById("levelText"),
  moves: document.getElementById("movesText"),
  toast: document.getElementById("toast"),
  startScreen: document.getElementById("startScreen"),
  telegramLoginBox: document.getElementById("telegramLoginBox"),
  telegramProfile: document.getElementById("telegramProfile"),
  sheetBalance: document.getElementById("sheetBalance"),
  rewardLog: document.getElementById("rewardLog"),
  withdrawLog: document.getElementById("withdrawLog"),
  withdrawForm: document.getElementById("withdrawForm"),
  withdrawJump: document.getElementById("withdrawJumpBtn"),
  danaNumber: document.getElementById("danaNumberInput"),
  withdrawAmount: document.getElementById("withdrawAmountInput"),
  missionList: document.getElementById("missionList"),
  hammerText: document.getElementById("hammerText"),
  shuffleText: document.getElementById("shuffleText"),
  extraMovesText: document.getElementById("extraMovesText"),
};

const saveKey = "dana-match-puzzle-v1";
const telegramBotUsername = "";
const economy = {
  matchRpDivisor: 18,
  comboRpDivisor: 10,
  levelBaseReward: 18,
  levelRewardStep: 7,
};
const rows = 8;
const cols = 8;
const tileSize = 40;
const gap = 5;
const boardX = 18;
const boardY = 302;
const getDifficulty = (level) => ({
  activeTypes: Math.min(tileTypes.length, level >= 3 ? 6 : 5),
  targetScore: 1100 + level * 560 + Math.floor(level ** 1.35) * 90,
  moves: Math.max(16, 25 - Math.floor(level / 2)),
  blockedCells: level < 4 ? 0 : Math.min(10, 2 + Math.floor((level - 4) * 1.4)),
});
const tileTypes = [
  { id: "diamond", icon: "◆", colors: ["#a7f4ff", "#12d6ff", "#1679ff"] },
  { id: "coin", icon: "●", colors: ["#fff3a3", "#ffd76a", "#ff9f2f"] },
  { id: "wallet", icon: "▰", colors: ["#b2ffea", "#22f5bd", "#049b85"] },
  { id: "star", icon: "★", colors: ["#fff7ce", "#ffdc43", "#ff6f2f"] },
  { id: "drop", icon: "◐", colors: ["#c9f6ff", "#62d8ff", "#275dff"] },
  { id: "gift", icon: "✦", colors: ["#ffd2fb", "#ff4fd8", "#8a3dff"] },
];

const spriteBase = "assets/generated/sprites/";
const spriteFiles = {
  tile_diamond: "tile_diamond.png",
  tile_coin: "tile_coin.png",
  tile_wallet: "tile_wallet.png",
  tile_star: "tile_star.png",
  tile_drop: "tile_drop.png",
  tile_gift: "tile_gift.png",
  fx_blue_burst: "fx_blue_burst.png",
  fx_coin_burst: "fx_coin_burst.png",
  fx_wallet_burst: "fx_wallet_burst.png",
  fx_pink_burst: "fx_pink_burst.png",
  badge_match: "badge_match.png",
  badge_combo_x2: "badge_combo_x2.png",
  badge_combo_x3: "badge_combo_x3.png",
};
const sprites = Object.fromEntries(Object.entries(spriteFiles).map(([key, file]) => {
  const img = new Image();
  img.src = spriteBase + file;
  return [key, img];
}));
const gameplayBg = new Image();
gameplayBg.src = "assets/generated/gameplay-background.png";
const tileSpriteKeys = ["tile_diamond", "tile_coin", "tile_wallet", "tile_star", "tile_drop", "tile_gift"];
const fxSpriteKeys = ["fx_blue_burst", "fx_coin_burst", "fx_wallet_burst", "fx_pink_burst"];

let selected = null;
let inputLocked = false;
let started = false;
let muted = false;
let last = performance.now();
let particles = [];
let floaters = [];
let spriteBursts = [];
let shake = 0;
let comboBanner = { text: "", life: 0 };
let hammerMode = false;
let dragStart = null;
let animTiles = [];

const defaultState = () => {
  const difficulty = getDifficulty(1);
  return {
    balanceRp: 0,
    coins: 240,
    level: 1,
    xp: 0,
    moves: difficulty.moves,
    score: 0,
    targetScore: difficulty.targetScore,
    board: [],
    boosters: { hammer: 1, shuffle: 1, moves: 0 },
    missions: [
      { id: "score", label: "Raih 2.000 score", target: 2000, progress: 0 },
      { id: "combo", label: "Buat combo x3", target: 3, progress: 0 },
      { id: "clear", label: "Hancurkan 80 tile", target: 80, progress: 0 },
    ],
    bestCombo: 0,
    rewardLog: [],
    withdrawals: [],
    telegramUser: null,
  };
};

let state = load();
if (!Array.isArray(state.board) || state.board.length !== rows) state.board = createBoard();

function load() {
  try {
    return { ...defaultState(), ...JSON.parse(localStorage.getItem(saveKey) || "{}") };
  } catch {
    return defaultState();
  }
}
function save() {
  localStorage.setItem(saveKey, JSON.stringify(state));
}
function money(n) {
  return `Rp${Math.floor(n).toLocaleString("id-ID")}`;
}
function displayTelegramName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Player Telegram";
}
function renderTelegramLogin() {
  els.telegramLoginBox.innerHTML = "";
  els.telegramProfile.innerHTML = "";
  if (state.telegramUser) {
    els.telegramProfile.classList.remove("hidden");
    const user = state.telegramUser;
    const avatar = user.photo_url ? document.createElement("img") : document.createElement("span");
    if (user.photo_url) avatar.src = user.photo_url;
    else avatar.textContent = displayTelegramName(user).slice(0, 1).toUpperCase();
    avatar.className = user.photo_url ? "" : "telegram-avatar";
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = displayTelegramName(user);
    const username = document.createElement("span");
    username.textContent = user.username ? `@${user.username}` : "Telegram connected";
    copy.append(name, username);
    const logout = document.createElement("button");
    logout.className = "telegram-logout";
    logout.type = "button";
    logout.textContent = "Logout";
    logout.addEventListener("click", () => {
      state.telegramUser = null;
      save();
      renderTelegramLogin();
      toast("Logout Telegram lokal");
    });
    els.telegramProfile.append(avatar, copy, logout);
    return;
  }
  els.telegramProfile.classList.add("hidden");
  if (!telegramBotUsername) {
    const placeholder = document.createElement("div");
    placeholder.className = "telegram-placeholder";
    placeholder.textContent = "Siapkan bot via BotFather, lalu isi telegramBotUsername di game.js";
    els.telegramLoginBox.append(placeholder);
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.dataset.telegramLogin = telegramBotUsername;
  script.dataset.size = "large";
  script.dataset.userpic = "true";
  script.dataset.onauth = "onTelegramAuth(user)";
  els.telegramLoginBox.append(script);
}
window.onTelegramAuth = (user) => {
  state.telegramUser = {
    id: user.id,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || "",
    photo_url: user.photo_url || "",
  };
  save();
  renderTelegramLogin();
  toast("Login Telegram berhasil");
};
function randType() {
  return Math.floor(Math.random() * getDifficulty(state?.level || 1).activeTypes);
}
function tile(type = randType(), special = null) {
  return { type, special, id: Math.random().toString(36).slice(2) };
}
function blocker() {
  return { blocked: true, id: Math.random().toString(36).slice(2) };
}
function isBlocked(cell) {
  return !!cell?.blocked;
}
function cloneBoard(board) {
  return board.map((r) => r.map((c) => (c ? { ...c } : null)));
}

function createBoard() {
  let board;
  do {
    board = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type;
        do {
          type = randType();
        } while (
          (c >= 2 && board[r][c - 1]?.type === type && board[r][c - 2]?.type === type) ||
          (r >= 2 && board[r - 1][c]?.type === type && board[r - 2][c]?.type === type)
        );
        board[r][c] = tile(type);
      }
    }
    addBlockers(board);
  } while (!hasValidMove(board));
  return board;
}
function addBlockers(board) {
  const total = getDifficulty(state?.level || 1).blockedCells;
  const spots = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 0; c < cols; c++) spots.push({ r, c });
  for (let i = 0; i < total && spots.length; i++) {
    const pick = Math.floor(Math.random() * spots.length);
    const { r, c } = spots.splice(pick, 1)[0];
    board[r][c] = blocker();
  }
}

function findMatches(board) {
  const hits = new Map();
  const groups = [];
  const addGroup = (cells, dir) => {
    if (cells.length < 3) return;
    groups.push({ cells, dir });
    cells.forEach((cell) => hits.set(`${cell.r},${cell.c}`, cell));
  };
  for (let r = 0; r < rows; r++) {
    let run = [{ r, c: 0 }];
    for (let c = 1; c <= cols; c++) {
      if (c < cols && board[r][c] && board[r][c - 1] && !isBlocked(board[r][c]) && !isBlocked(board[r][c - 1]) && board[r][c].type === board[r][c - 1].type && !board[r][c].special && !board[r][c - 1].special) run.push({ r, c });
      else {
        addGroup(run, "h");
        run = [{ r, c }];
      }
    }
  }
  for (let c = 0; c < cols; c++) {
    let run = [{ r: 0, c }];
    for (let r = 1; r <= rows; r++) {
      if (r < rows && board[r][c] && board[r - 1][c] && !isBlocked(board[r][c]) && !isBlocked(board[r - 1][c]) && board[r][c].type === board[r - 1][c].type && !board[r][c].special && !board[r - 1][c].special) run.push({ r, c });
      else {
        addGroup(run, "v");
        run = [{ r, c }];
      }
    }
  }
  return { cells: [...hits.values()], groups };
}
function hasValidMove(board) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    for (const [dr, dc] of [[1, 0], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr >= rows || nc >= cols || isBlocked(board[r][c]) || isBlocked(board[nr][nc])) continue;
      const copy = cloneBoard(board);
      [copy[r][c], copy[nr][nc]] = [copy[nr][nc], copy[r][c]];
      if (findMatches(copy).cells.length) return true;
    }
  }
  return false;
}
function adjacent(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}
function cellAt(x, y) {
  const c = Math.floor((x - boardX) / (tileSize + gap));
  const r = Math.floor((y - boardY) / (tileSize + gap));
  const lx = x - boardX - c * (tileSize + gap);
  const ly = y - boardY - r * (tileSize + gap);
  if (r < 0 || c < 0 || r >= rows || c >= cols || lx > tileSize || ly > tileSize) return null;
  return { r, c };
}
function swapInBoard(a, b) {
  [state.board[a.r][a.c], state.board[b.r][b.c]] = [state.board[b.r][b.c], state.board[a.r][a.c]];
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trySwap(a, b) {
  if (inputLocked || !adjacent(a, b)) return;
  if (isBlocked(state.board[a.r][a.c]) || isBlocked(state.board[b.r][b.c])) {
    selected = null;
    toast("Tile terkunci");
    sound(210, .05);
    return;
  }
  inputLocked = true;
  selected = null;
  swapInBoard(a, b);
  sound(520, .04);
  let matches = findMatches(state.board);
  const specialHit = activateSpecial(a) || activateSpecial(b);
  if (!matches.cells.length && !specialHit) {
    await sleep(120);
    swapInBoard(a, b);
    toast("Gerakan belum cocok");
    sound(220, .06);
    inputLocked = false;
    return;
  }
  state.moves = Math.max(0, state.moves - 1);
  await resolveBoard(1, matches);
  if (!hasValidMove(state.board)) shuffleBoard(false);
  checkLevelEnd();
  save();
  updateHUD();
  inputLocked = false;
}

function activateSpecial(cell) {
  const t = state.board[cell.r][cell.c];
  if (isBlocked(t) || !t?.special) return false;
  const cells = [];
  if (t.special === "lineH") for (let c = 0; c < cols; c++) cells.push({ r: cell.r, c });
  if (t.special === "lineV") for (let r = 0; r < rows; r++) cells.push({ r, c: cell.c });
  if (t.special === "rainbow") {
    const target = randType();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (state.board[r][c]?.type === target) cells.push({ r, c });
  }
  clearCells(cells, 2);
  return true;
}

async function resolveBoard(combo = 1, firstMatches = null) {
  let matches = firstMatches || findMatches(state.board);
  while (matches.cells.length) {
    state.bestCombo = Math.max(state.bestCombo, combo);
    updateMission("combo", combo);
    comboBanner = { text: combo > 1 ? `Combo x${combo}` : "MATCH!", life: 1 };
    makeSpecials(matches.groups);
    clearCells(matches.cells, combo);
    await sleep(180);
    dropTiles();
    await sleep(180);
    matches = findMatches(state.board);
    combo++;
  }
}
function makeSpecials(groups) {
  groups.forEach((g) => {
    if (g.cells.length < 4) return;
    const pivot = g.cells[Math.floor(g.cells.length / 2)];
    const t = state.board[pivot.r][pivot.c];
    if (!t) return;
    t.special = g.cells.length >= 5 ? "rainbow" : g.dir === "h" ? "lineH" : "lineV";
  });
}
function clearCells(cells, combo) {
  const unique = [...new Map(cells.map((c) => [`${c.r},${c.c}`, c])).values()];
  const score = unique.length * 45 * combo;
  const coin = Math.ceil(unique.length * combo * 1.6);
  const rp = combo > 1
    ? Math.floor((unique.length * combo) / economy.comboRpDivisor)
    : Math.floor(unique.length / economy.matchRpDivisor);
  state.score += score;
  state.coins += coin;
  state.balanceRp += rp;
  updateMission("score", state.score);
  updateMission("clear", unique.length, true);
  unique.forEach(({ r, c }) => {
    const x = boardX + c * (tileSize + gap) + tileSize / 2;
    const y = boardY + r * (tileSize + gap) + tileSize / 2;
    burst(x, y, tileTypes[state.board[r][c]?.type || 0].colors[1], 8 + combo * 2);
    spriteBurst(x, y, state.board[r][c]?.type || 0, combo);
    state.board[r][c] = null;
  });
  floater(`+${score}`, 170, 254, "#fff2a8");
  if (rp > 0) floater(`+${money(rp)}`, 143, 284, "#72ffdd");
  shake = Math.min(8, combo * 2);
  sound(700 + combo * 70, .07);
}
function dropTiles() {
  for (let c = 0; c < cols; c++) {
    let segment = [];
    const flush = () => {
      const stack = segment.filter((r) => state.board[r][c] && !isBlocked(state.board[r][c])).map((r) => state.board[r][c]);
      for (let i = 0; i < segment.length; i++) state.board[segment[i]][c] = stack.shift() || tile();
      segment = [];
    };
    for (let r = rows - 1; r >= 0; r--) {
      if (isBlocked(state.board[r][c])) flush();
      else segment.push(r);
    }
    flush();
  }
}
function shuffleBoard(cost = true) {
  if (cost) {
    if (state.boosters.shuffle <= 0) return toast("Booster shuffle belum ada");
    state.boosters.shuffle--;
  }
  state.board = createBoard();
  selected = null;
  burst(195, 470, "#12d6ff", 38);
  toast("Board diacak ulang");
  sound(420, .12);
  save();
  updateHUD();
}
function useHammer(cell) {
  if (state.boosters.hammer <= 0) return false;
  state.boosters.hammer--;
  hammerMode = false;
  clearCells([cell], 1);
  dropTiles();
  resolveBoard(1);
  toast("Hammer menghancurkan tile");
  save();
  updateHUD();
  return true;
}

function updateMission(id, value, add = false) {
  const mission = state.missions.find((m) => m.id === id);
  if (!mission) return;
  mission.progress = Math.min(mission.target, add ? mission.progress + value : Math.max(mission.progress, value));
}
function checkLevelEnd() {
  if (state.score < state.targetScore && state.moves > 0) return;
  if (state.score >= state.targetScore) {
    const reward = economy.levelBaseReward + state.level * economy.levelRewardStep;
    state.balanceRp += reward;
    state.coins += 80 + state.level * 12;
    state.rewardLog.unshift({ level: state.level, reward, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
    state.rewardLog = state.rewardLog.slice(0, 6);
    state.level++;
    const difficulty = getDifficulty(state.level);
    state.score = 0;
    state.targetScore = difficulty.targetScore;
    state.moves = difficulty.moves;
    state.board = createBoard();
    toast(`Level selesai! Bonus ${money(reward)}`);
    burst(195, 250, "#ffd76a", 70);
    sound(940, .18);
  } else {
    const difficulty = getDifficulty(state.level);
    toast("Moves habis, board diulang dengan target sama");
    state.moves = difficulty.moves;
    state.targetScore = difficulty.targetScore;
    state.score = 0;
    state.board = createBoard();
  }
}

function maskDanaNumber(number) {
  const clean = number.replace(/\D/g, "");
  return clean.length <= 7 ? clean : `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}
function submitWithdrawal(ev) {
  ev.preventDefault();
  const number = els.danaNumber.value.trim().replace(/\D/g, "");
  const amount = Math.floor(Number(els.withdrawAmount.value));
  if (!/^\d{10,13}$/.test(number)) return toast("Nomor DANA harus 10-13 digit");
  if (!amount || amount < 10) return toast("Minimal penarikan Rp10");
  if (amount > state.balanceRp) return toast("Saldo simulasi belum cukup");
  state.balanceRp -= amount;
  const withdrawal = {
    id: Math.random().toString(36).slice(2),
    amount,
    number: maskDanaNumber(number),
    status: "Diproses",
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  state.withdrawals.unshift(withdrawal);
  state.withdrawals = state.withdrawals.slice(0, 8);
  els.withdrawAmount.value = "";
  save();
  updateHUD();
  toast(`Penarikan ${money(amount)} sedang diproses`);
  setTimeout(() => resolveWithdrawal(withdrawal.id), 1200);
}
function resolveWithdrawal(id) {
  const log = state.withdrawals.find((item) => item.id === id);
  if (!log || log.status !== "Diproses") return;
  const rejected = Math.random() < 0.18;
  log.status = rejected ? "Ditolak" : "Sukses";
  if (rejected) state.balanceRp += log.amount;
  save();
  updateHUD();
  toast(rejected ? "Penarikan ditolak, saldo dikembalikan" : "Penarikan simulasi sukses");
}

function updateHUD() {
  if (els.balance) els.balance.textContent = money(state.balanceRp).replace("Rp", "");
  els.topBalance.textContent = money(state.balanceRp).replace("Rp", "");
  els.coins.textContent = state.coins;
  els.level.textContent = state.level;
  els.moves.textContent = state.moves;
  els.sheetBalance.textContent = money(state.balanceRp);
  els.hammerText.textContent = `${state.boosters.hammer} stok`;
  els.shuffleText.textContent = `${state.boosters.shuffle} stok`;
  els.extraMovesText.textContent = `${state.boosters.moves} stok`;
  els.withdrawLog.innerHTML = state.withdrawals.length
    ? state.withdrawals.map((log) => `<div class="log-item withdraw-status ${String(log.status || "Sukses").toLowerCase()}"><span>${log.number} • ${log.time}<small>${log.status || "Sukses"}</small></span><b>${money(log.amount)}</b></div>`).join("")
    : `<div class="log-item"><span>Belum ada penarikan DANA</span><b>Simulasi</b></div>`;
  els.rewardLog.innerHTML = state.rewardLog.length
    ? state.rewardLog.map((log) => `<div class="log-item"><span>Level ${log.level} • ${log.time}</span><b>+${money(log.reward)}</b></div>`).join("")
    : `<div class="log-item"><span>Belum ada reward level</span><b>Main dulu</b></div>`;
  els.missionList.innerHTML = state.missions.map((m) => {
    const done = m.progress >= m.target;
    return `<div class="mission-item${done ? " done" : ""}"><span>${m.label}</span><b>${Math.min(m.progress, m.target)}/${m.target}</b></div>`;
  }).join("");
}
function toast(text) {
  els.toast.textContent = text;
  els.toast.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.add("hidden"), 1600);
}
function sound(freq = 440, dur = 0.05) {
  if (muted) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  sound.ctx ||= new AudioCtx();
  const o = sound.ctx.createOscillator();
  const g = sound.ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.value = 0.035;
  o.connect(g);
  g.connect(sound.ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, sound.ctx.currentTime + dur);
  o.stop(sound.ctx.currentTime + dur);
}

function draw() {
  const t = performance.now() / 1000;
  const sx = (Math.random() - .5) * shake;
  const sy = (Math.random() - .5) * shake;
  shake *= .86;
  ctx.save();
  ctx.translate(sx, sy);
  drawBackground(t);
  drawScorePanel(t);
  drawBoard(t);
  drawSpriteBursts();
  drawParticles();
  drawFloaters();
  drawCombo();
  ctx.restore();
}
function drawBackground(t) {
  if (gameplayBg.complete && gameplayBg.naturalWidth > 0) {
    const scale = Math.max(W / gameplayBg.naturalWidth, H / gameplayBg.naturalHeight);
    const dw = gameplayBg.naturalWidth * scale;
    const dh = gameplayBg.naturalHeight * scale;
    ctx.drawImage(gameplayBg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const veil = ctx.createLinearGradient(0, 0, 0, H);
    veil.addColorStop(0, "rgba(255,255,255,.12)");
    veil.addColorStop(.42, "rgba(255,255,255,.2)");
    veil.addColorStop(1, "rgba(220,236,255,.18)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(.5, "#f2f8ff");
  g.addColorStop(1, "#dcecff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function glowCircle(x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function spriteReady(key) {
  return sprites[key]?.complete && sprites[key].naturalWidth > 0;
}
function drawSpriteContain(key, x, y, w, h, alpha = 1) {
  if (!spriteReady(key)) return false;
  const img = sprites[key];
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}
function drawScorePanel(t) {
  roundRect(24, 112, 342, 136, 28, "rgba(255,255,255,.72)", "rgba(255,255,255,.78)");
  roundRect(32, 120, 326, 120, 22, "rgba(238,248,255,.58)", "rgba(255,255,255,.46)");
  const topGlow = ctx.createLinearGradient(32, 120, 358, 240);
  topGlow.addColorStop(0, "rgba(255,255,255,.42)");
  topGlow.addColorStop(.55, "rgba(255,255,255,.08)");
  topGlow.addColorStop(1, "rgba(22,200,189,.05)");
  roundRect(32, 120, 326, 120, 22, topGlow);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#6f7f96";
  ctx.font = "900 11px Nunito";
  ctx.fillText("TARGET", 48, 146);
  ctx.fillText("SCORE", 48, 204);

  ctx.font = "900 28px Nunito";
  ctx.fillStyle = "#102443";
  ctx.fillText(state.targetScore.toLocaleString("id-ID"), 48, 177);
  ctx.fillStyle = "#0754d9";
  ctx.fillText(state.score.toLocaleString("id-ID"), 48, 232);

  const pct = Math.min(1, state.score / state.targetScore);
  roundRect(188, 196, 142, 15, 99, "rgba(197,221,244,.72)");
  const bar = ctx.createLinearGradient(188, 196, 330, 211);
  bar.addColorStop(0, "#1388ff");
  bar.addColorStop(.52, "#16c8bd");
  bar.addColorStop(1, "#8f39f6");
  roundRect(188, 196, 142 * pct, 15, 99, bar);
  roundRect(188, 196, 142, 15, 99, null, "rgba(255,255,255,.72)");
  ctx.fillStyle = "#6f7f96";
  ctx.font = "900 10px Nunito";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.floor(pct * 100)}%`, 259, 229);

  roundRect(200, 139, 118, 38, 19, "rgba(255,255,255,.6)", "rgba(255,255,255,.58)");
  ctx.fillStyle = "#6f7f96";
  ctx.font = "900 10px Nunito";
  ctx.textAlign = "left";
  ctx.fillText("REWARD", 249, 155);
  ctx.fillStyle = "#0754d9";
  ctx.font = "900 15px Nunito";
  ctx.fillText("Rupiah", 249, 173);
  if (spriteReady("tile_coin")) drawSpriteContain("tile_coin", 204, 132, 42, 42, .92);

  ctx.textAlign = "left";
}
function drawBoard(t) {
  const panelW = cols * tileSize + (cols - 1) * gap + 22;
  const panelH = rows * tileSize + (rows - 1) * gap + 22;
  roundRect(boardX - 14, boardY - 14, panelW + 6, panelH + 6, 31, "rgba(7,84,217,.12)");
  roundRect(boardX - 11, boardY - 11, panelW, panelH, 28, "rgba(255,255,255,.78)", "rgba(255,255,255,.86)");
  roundRect(boardX - 6, boardY - 6, panelW - 10, panelH - 10, 24, "rgba(231,244,255,.54)", "rgba(255,255,255,.55)");
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawTile(r, c, t);
}
function drawTile(r, c, t) {
  const x = boardX + c * (tileSize + gap);
  const y = boardY + r * (tileSize + gap);
  const item = state.board[r][c];
  roundRect(x, y, tileSize, tileSize, 12, "rgba(19,34,58,.04)");
  if (!item) return;
  if (isBlocked(item)) {
    const g = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
    g.addColorStop(0, "rgba(255,255,255,.82)");
    g.addColorStop(.48, "rgba(174,211,244,.88)");
    g.addColorStop(1, "rgba(84,128,184,.9)");
    roundRect(x, y, tileSize, tileSize, 12, g, "rgba(255,255,255,.9)");
    ctx.fillStyle = "rgba(7,84,217,.5)";
    ctx.font = "900 18px Nunito";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LOCK", x + tileSize / 2, y + tileSize / 2 + 1);
    return;
  }
  const type = tileTypes[item.type];
  const isSel = selected?.r === r && selected?.c === c;
  const pulse = isSel ? Math.sin(t * 9) * 2 + 3 : 0;
  const spriteKey = tileSpriteKeys[item.type];
  if (spriteReady(spriteKey)) {
    ctx.save();
    ctx.shadowColor = type.colors[1];
    ctx.shadowBlur = isSel ? 16 : 0;
    drawSpriteContain(spriteKey, x - 3 - pulse / 2, y - 3 - pulse / 2, tileSize + 6 + pulse, tileSize + 6 + pulse);
    ctx.shadowBlur = 0;
    if (item.special === "rainbow") {
      ctx.fillStyle = "rgba(255,255,255,.96)";
      ctx.strokeStyle = "rgba(19,136,255,.85)";
      ctx.lineWidth = 2;
      ctx.font = "900 22px Nunito";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("*", x + tileSize / 2, y + tileSize / 2 + 1);
      ctx.fillText("*", x + tileSize / 2, y + tileSize / 2 + 1);
    }
    if (item.special === "lineH" || item.special === "lineV") {
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (item.special === "lineH") { ctx.moveTo(x + 8, y + 20); ctx.lineTo(x + 32, y + 20); }
      else { ctx.moveTo(x + 20, y + 8); ctx.lineTo(x + 20, y + 32); }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.shadowColor = type.colors[1];
  ctx.shadowBlur = isSel ? 14 : 0;
  const g = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
  g.addColorStop(0, type.colors[0]);
  g.addColorStop(.58, type.colors[1]);
  g.addColorStop(1, type.colors[2]);
  roundRect(x - pulse / 2, y - pulse / 2, tileSize + pulse, tileSize + pulse, 13, g, isSel ? "rgba(255,255,255,.88)" : "rgba(255,255,255,.22)");
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,.24)";
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 10, 10, 4, -.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(19,34,58,.78)";
  ctx.font = item.special === "rainbow" ? "900 25px Baloo 2" : "900 24px Baloo 2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.special === "rainbow" ? "✺" : type.icon, x + tileSize / 2, y + tileSize / 2 + 1);
  if (item.special === "lineH" || item.special === "lineV") {
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (item.special === "lineH") { ctx.moveTo(x + 9, y + 20); ctx.lineTo(x + 31, y + 20); }
    else { ctx.moveTo(x + 20, y + 9); ctx.lineTo(x + 20, y + 31); }
    ctx.stroke();
  }
  ctx.restore();
}
function burst(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - .5) * 5, vy: (Math.random() - .9) * 5, r: 2 + Math.random() * 4, color, life: 1 });
}
function spriteBurst(x, y, type, combo = 1) {
  const key = fxSpriteKeys[type % fxSpriteKeys.length];
  if (!spriteReady(key)) return;
  spriteBursts.push({
    key,
    x,
    y,
    size: 66 + combo * 12,
    rotation: (Math.random() - .5) * .35,
    life: 1,
  });
}
function floater(text, x, y, color) {
  floaters.push({ text, x, y, vy: -1.1, life: 1, color });
}
function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}
function drawSpriteBursts() {
  spriteBursts.forEach((b) => {
    if (!spriteReady(b.key)) return;
    const img = sprites[b.key];
    const scale = b.size / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life * 1.25);
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  });
}
function drawFloaters() {
  ctx.font = "900 17px Nunito";
  ctx.textAlign = "left";
  floaters.forEach((f) => {
    ctx.globalAlpha = f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  });
}
function drawCombo() {
  if (comboBanner.life <= 0) return;
  const comboKey = comboBanner.text.includes("x3") ? "badge_combo_x3" : comboBanner.text.includes("x2") ? "badge_combo_x2" : "badge_match";
  if (spriteReady(comboKey)) {
    const scale = .74 + (1 - comboBanner.life) * .08;
    ctx.save();
    ctx.globalAlpha = comboBanner.life;
    ctx.translate(195, 294);
    ctx.scale(scale, scale);
    ctx.drawImage(sprites[comboKey], -112, -62, 224, 124);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = comboBanner.life;
  roundRect(108, 270, 174, 42, 21, "rgba(19,136,255,.92)");
  ctx.fillStyle = "#fff";
  ctx.font = "900 24px Nunito";
  ctx.textAlign = "center";
  ctx.fillText(comboBanner.text, 195, 298);
  ctx.globalAlpha = 1;
}
function tick(now) {
  const dt = Math.min((now - last) / 16.67, 3);
  last = now;
  particles = particles.filter((p) => ((p.x += p.vx * dt), (p.y += p.vy * dt), (p.vy += .08 * dt), (p.life -= .022 * dt), p.life > 0));
  floaters = floaters.filter((f) => ((f.y += f.vy * dt), (f.life -= .014 * dt), f.life > 0));
  spriteBursts = spriteBursts.filter((b) => ((b.size += 1.8 * dt), (b.life -= .035 * dt), b.life > 0));
  comboBanner.life = Math.max(0, comboBanner.life - .018 * dt);
  draw();
  requestAnimationFrame(tick);
}

function canvasPoint(ev) {
  const r = canvas.getBoundingClientRect();
  const touch = ev.touches ? ev.touches[0] : ev;
  return { x: ((touch.clientX - r.left) / r.width) * W, y: ((touch.clientY - r.top) / r.height) * H };
}
canvas.addEventListener("pointerdown", (ev) => {
  if (!started || inputLocked) return;
  dragStart = canvasPoint(ev);
});
canvas.addEventListener("pointerup", (ev) => {
  if (!started || inputLocked || !dragStart) return;
  const end = canvasPoint(ev);
  const from = cellAt(dragStart.x, dragStart.y);
  if (!from) return;
  const dx = end.x - dragStart.x;
  const dy = end.y - dragStart.y;
  let to = cellAt(end.x, end.y);
  if (Math.hypot(dx, dy) > 24) {
    if (Math.abs(dx) > Math.abs(dy)) to = { r: from.r, c: from.c + Math.sign(dx) };
    else to = { r: from.r + Math.sign(dy), c: from.c };
  }
  dragStart = null;
  if (!to || to.r < 0 || to.c < 0 || to.r >= rows || to.c >= cols) return;
  if (hammerMode) return useHammer(from);
  if (isBlocked(state.board[from.r][from.c])) {
    toast("Tile terkunci");
    sound(210, .05);
    return;
  }
  if (!selected) {
    selected = from;
    sound(460, .035);
    return;
  }
  if (selected.r === to.r && selected.c === to.c) {
    selected = null;
    return;
  }
  if (adjacent(selected, to)) trySwap(selected, to);
  else {
    selected = to;
    sound(460, .035);
  }
});

function setActiveNav(panelId = null) {
  document.querySelectorAll(".bottom-dock button").forEach((btn) => btn.classList.toggle("active", panelId ? btn.dataset.panel === panelId : btn.id === "homeBtn"));
}
function closeSheets(reset = true) {
  document.querySelectorAll(".sheet").forEach((s) => s.classList.add("hidden"));
  if (reset) setActiveNav();
}
function openSheet(id) {
  closeSheets(false);
  document.getElementById(id).classList.remove("hidden");
  setActiveNav(id);
  updateHUD();
  sound(360, .04);
}

document.getElementById("startBtn").addEventListener("click", () => {
  started = true;
  els.startScreen.classList.add("hidden");
  toast("Swipe tile untuk mulai combo");
  sound(620, .08);
});
document.getElementById("soundBtn").addEventListener("click", () => {
  muted = !muted;
  document.getElementById("soundBtn").textContent = muted ? "×" : "♪";
});
document.querySelectorAll("[data-panel]").forEach((btn) => btn.addEventListener("click", () => openSheet(btn.dataset.panel)));
els.withdrawForm.addEventListener("submit", submitWithdrawal);
els.withdrawJump.addEventListener("click", () => {
  els.withdrawForm.classList.remove("hidden");
  els.withdrawForm.scrollIntoView({ behavior: "smooth", block: "center" });
  els.danaNumber.focus();
});
document.querySelectorAll(".close-sheet").forEach((btn) => btn.addEventListener("click", closeSheets));
document.getElementById("homeBtn").addEventListener("click", () => closeSheets());
document.querySelectorAll("[data-booster]").forEach((btn) => btn.addEventListener("click", () => {
  const type = btn.dataset.booster;
  const prices = { hammer: 120, shuffle: 90, moves: 150 };
  if (type === "shuffle" && state.boosters.shuffle > 0) return shuffleBoard(true);
  if (type === "hammer" && state.boosters.hammer > 0) {
    hammerMode = true;
    toast("Hammer aktif: tap tile di board");
    closeSheets();
    return;
  }
  if (type === "moves" && state.boosters.moves > 0) {
    state.boosters.moves--;
    state.moves += 5;
    toast("Moves +5 dipakai");
    save();
    updateHUD();
    return;
  }
  if (state.coins < prices[type]) return toast("Koin belum cukup");
  state.coins -= prices[type];
  state.boosters[type]++;
  toast(`${type} masuk inventory`);
  save();
  updateHUD();
}));
document.getElementById("resetBtn").addEventListener("click", () => {
  localStorage.removeItem(saveKey);
  state = defaultState();
  state.board = createBoard();
  selected = null;
  hammerMode = false;
  updateHUD();
  renderTelegramLogin();
  toast("Progress direset");
});

updateHUD();
renderTelegramLogin();
requestAnimationFrame(tick);
setInterval(save, 3000);
