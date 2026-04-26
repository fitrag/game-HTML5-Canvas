const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const modeButtons = document.querySelectorAll("[data-mode]");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const themeButtons = document.querySelectorAll("[data-board-theme]");
const difficultyGroup = document.getElementById("difficultyGroup");
const startGameButton = document.getElementById("startGame");
const backMenuButton = document.getElementById("backMenu");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const modeText = document.getElementById("modeText");
const difficultyText = document.getElementById("difficultyText");
const turnText = document.getElementById("turnText");
const statusText = document.getElementById("statusText");
const whiteCaptured = document.getElementById("whiteCaptured");
const blackCaptured = document.getElementById("blackCaptured");
const newGameButton = document.getElementById("newGame");
const statusPopup = document.getElementById("statusPopup");
const popupKicker = document.getElementById("popupKicker");
const popupTitle = document.getElementById("popupTitle");
const popupMessage = document.getElementById("popupMessage");
const popupContinue = document.getElementById("popupContinue");
const popupNewGame = document.getElementById("popupNewGame");

const S = canvas.width / 8;
const symbols = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};
const pieceValues = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const difficultyLabels = { easy: "Mudah", normal: "Normal", hard: "Sulit" };
const boardThemes = {
  classic: { light: "#eadfc8", dark: "#9f7a5b" },
  forest: { light: "#d9e7cf", dark: "#59745a" },
  ocean: { light: "#d7e8ea", dark: "#4d7f91" },
  mono: { light: "#e8e4dc", dark: "#4c4a45" },
};

let board,
  turn,
  selected,
  legalMoves,
  capturedByWhite,
  capturedByBlack,
  castleRights,
  enPassant,
  gameOver,
  lastMove,
  animatingMove;
let gameMode = "pvp";
let difficulty = "easy";
let boardTheme = "classic";
let botColor = "b";
let botThinking = false;

function resetGame() {
  board = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
  ];
  turn = "w";
  selected = null;
  legalMoves = [];
  capturedByWhite = [];
  capturedByBlack = [];
  castleRights = { wK: true, wQ: true, bK: true, bQ: true };
  enPassant = null;
  gameOver = false;
  botThinking = false;
  lastMove = null;
  animatingMove = null;
  hideStatusPopup();
  updateUI("Pilih bidak untuk melihat langkah legal.");
  draw();
}

function colorOf(piece) {
  return piece && piece[0];
}
function typeOf(piece) {
  return piece && piece[1];
}
function inside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function cloneBoard(b) {
  return b.map((row) => row.slice());
}
function opposite(color) {
  return color === "w" ? "b" : "w";
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawCoordinates();
  drawHighlights();
  drawPieces();
}

function drawBoard() {
  const theme = boardThemes[boardTheme];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? theme.light : theme.dark;
      ctx.fillRect(c * S, r * S, S, S);
    }
  }
}

function drawCoordinates() {
  const theme = boardThemes[boardTheme];
  ctx.save();
  ctx.font = "700 14px Manrope, sans-serif";
  ctx.globalAlpha = 0.58;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? theme.dark : theme.light;
    ctx.fillText(8 - i, 9, i * S + 20);
    ctx.fillText(
      String.fromCharCode(97 + i),
      i * S + S - 20,
      canvas.height - 10,
    );
  }
  ctx.restore();
}

function drawHighlights() {
  if (lastMove) {
    for (const sq of [lastMove.from, lastMove.to]) {
      ctx.fillStyle = "rgba(29, 107, 95, .18)";
      ctx.fillRect(sq.c * S, sq.r * S, S, S);
    }
  }

  if (selected) {
    ctx.strokeStyle = "#1d6b5f";
    ctx.lineWidth = 5;
    ctx.strokeRect(selected.c * S + 6, selected.r * S + 6, S - 12, S - 12);
  }

  for (const move of legalMoves) {
    const x = move.c * S + S / 2;
    const y = move.r * S + S / 2;
    ctx.beginPath();
    ctx.fillStyle =
      board[move.r][move.c] || move.enPassant
        ? "rgba(112, 43, 31, .38)"
        : "rgba(29, 107, 95, .30)";
    ctx.arc(
      x,
      y,
      board[move.r][move.c] || move.enPassant ? 28 : 12,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawPieces() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${S * 0.68}px Georgia, serif`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (animatingMove && animatingMove.to.r === r && animatingMove.to.c === c)
        continue;
      drawPieceAt(board[r][c], c * S + S / 2, r * S + S / 2 + 4, 1);
    }
  }
  if (animatingMove) {
    drawPieceAt(
      animatingMove.piece,
      animatingMove.x,
      animatingMove.y + 4,
      1 + animatingMove.lift * 0.08,
    );
  }
  ctx.restore();
}

function drawPieceAt(piece, x, y, scale) {
  if (!piece) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = "rgba(0,0,0,.16)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = colorOf(piece) === "w" ? "#fffaf0" : "#211d18";
  ctx.fillText(symbols[piece], 0, 0);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle =
    colorOf(piece) === "w" ? "rgba(39,35,29,.28)" : "rgba(255,250,240,.20)";
  ctx.lineWidth = 1.2;
  ctx.strokeText(symbols[piece], 0, 0);
  ctx.restore();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    gameMode = button.dataset.mode;
    modeButtons.forEach((item) =>
      item.classList.toggle("active", item === button),
    );
    difficultyGroup.classList.toggle("enabled", gameMode === "bot");
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    difficulty = button.dataset.difficulty;
    difficultyButtons.forEach((item) =>
      item.classList.toggle("active", item === button),
    );
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    boardTheme = button.dataset.boardTheme;
    syncThemeButtons();
    draw();
  });
});

function syncThemeButtons() {
  themeButtons.forEach((button) =>
    button.classList.toggle("active", button.dataset.boardTheme === boardTheme),
  );
}

startGameButton.addEventListener("click", () => {
  menuScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  resetGame();
});

backMenuButton.addEventListener("click", () => {
  hideStatusPopup();
  menuScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
});

canvas.addEventListener("click", (event) => {
  if (gameOver || botThinking || animatingMove || isBotTurn()) return;
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor(((event.clientX - rect.left) / rect.width) * 8);
  const r = Math.floor(((event.clientY - rect.top) / rect.height) * 8);
  handleSquare(r, c);
});

newGameButton.addEventListener("click", resetGame);
popupContinue.addEventListener("click", hideStatusPopup);
popupNewGame.addEventListener("click", resetGame);

async function handleSquare(r, c) {
  const piece = board[r][c];
  if (selected) {
    const move = legalMoves.find((m) => m.r === r && m.c === c);
    if (move) {
      const from = { r: selected.r, c: selected.c };
      selected = null;
      legalMoves = [];
      await animateAndMakeMove(from.r, from.c, move);
      afterMove();
      draw();
      scheduleBotMove();
      return;
    }
  }

  if (piece && colorOf(piece) === turn) {
    selected = { r, c };
    legalMoves = getLegalMoves(r, c, board, turn);
    updateUI(`${symbols[piece]} memiliki ${legalMoves.length} langkah legal.`);
  } else {
    selected = null;
    legalMoves = [];
    updateUI("Pilih bidak milik giliran saat ini.");
  }
  draw();
}

function animateAndMakeMove(fr, fc, move) {
  const piece = board[fr][fc];
  const from = { r: fr, c: fc };
  const to = { r: move.r, c: move.c };
  const startX = fc * S + S / 2;
  const startY = fr * S + S / 2;
  const endX = move.c * S + S / 2;
  const endY = move.r * S + S / 2;

  makeMove(fr, fc, move);

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const duration = 260;
    const frame = (now) => {
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const lift = Math.sin(Math.PI * t);
      animatingMove = {
        piece,
        from,
        to,
        x: startX + (endX - startX) * eased,
        y: startY + (endY - startY) * eased - lift * 18,
        lift,
      };
      draw();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        animatingMove = null;
        draw();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

function makeMove(fr, fc, move) {
  const piece = board[fr][fc];
  let captured = board[move.r][move.c];

  if (move.enPassant) {
    captured = board[fr][move.c];
    board[fr][move.c] = null;
  }

  if (captured) {
    (turn === "w" ? capturedByWhite : capturedByBlack).push(captured);
  }

  board[move.r][move.c] = piece;
  board[fr][fc] = null;

  if (move.castle) {
    const rookFrom = move.c === 6 ? 7 : 0;
    const rookTo = move.c === 6 ? 5 : 3;
    board[move.r][rookTo] = board[move.r][rookFrom];
    board[move.r][rookFrom] = null;
  }

  if (typeOf(piece) === "P" && (move.r === 0 || move.r === 7)) {
    board[move.r][move.c] = turn + "Q";
  }

  updateCastleRights(piece, fr, fc);
  if (captured && typeOf(captured) === "R")
    updateCastleRights(captured, move.r, move.c);

  enPassant = null;
  if (typeOf(piece) === "P" && Math.abs(move.r - fr) === 2) {
    enPassant = { r: (move.r + fr) / 2, c: fc };
  }

  lastMove = { from: { r: fr, c: fc }, to: { r: move.r, c: move.c } };
  turn = opposite(turn);
}

function updateCastleRights(piece, r, c) {
  if (piece === "wK") {
    castleRights.wK = false;
    castleRights.wQ = false;
  }
  if (piece === "bK") {
    castleRights.bK = false;
    castleRights.bQ = false;
  }
  if (piece === "wR" && r === 7 && c === 0) castleRights.wQ = false;
  if (piece === "wR" && r === 7 && c === 7) castleRights.wK = false;
  if (piece === "bR" && r === 0 && c === 0) castleRights.bQ = false;
  if (piece === "bR" && r === 0 && c === 7) castleRights.bK = false;
}

function afterMove() {
  const inCheck = isInCheck(turn, board);
  const hasMoves = allLegalMoves(turn).length > 0;
  updateCaptured();
  turnText.textContent = turn === "w" ? "Putih" : "Hitam";

  if (!hasMoves && inCheck) {
    const winner = turn === "w" ? "Hitam" : "Putih";
    gameOver = true;
    statusText.textContent = `Skakmat. ${winner} menang.`;
    showStatusPopup(
      "Skakmat",
      "Checkmate!",
      `${winner} menang. Raja ${turn === "w" ? "putih" : "hitam"} tidak punya jalan keluar.`,
      true,
    );
  } else if (!hasMoves) {
    gameOver = true;
    statusText.textContent = "Stalemate. Permainan seri.";
    showStatusPopup(
      "Seri",
      "Stalemate",
      "Tidak ada langkah legal tersisa, tetapi raja tidak sedang skak.",
      true,
    );
  } else if (inCheck) {
    const checkedSide = turn === "w" ? "Putih" : "Hitam";
    statusText.textContent = `${checkedSide} sedang skak.`;
    showStatusPopup(
      "Skak",
      "Check!",
      `Raja ${checkedSide.toLowerCase()} sedang diserang. Cari langkah penyelamatan.`,
      false,
    );
  } else {
    hideStatusPopup();
    statusText.textContent = isBotTurn()
      ? "Bot sedang menyiapkan langkah."
      : "Pilih bidak untuk melihat langkah legal.";
  }
}

function updateUI(message) {
  modeText.textContent =
    gameMode === "bot" ? "Player vs Bot" : "Player vs Player";
  difficultyText.textContent =
    gameMode === "bot" ? `Bot: ${difficultyLabels[difficulty]}` : "Tanpa bot";
  turnText.textContent = turn === "w" ? "Putih" : "Hitam";
  statusText.textContent = message;
  updateCaptured();
}

function updateCaptured() {
  whiteCaptured.textContent = capturedByWhite.map((p) => symbols[p]).join(" ");
  blackCaptured.textContent = capturedByBlack.map((p) => symbols[p]).join(" ");
}

function allLegalMoves(color) {
  return allLegalMovesFor(color, board);
}

function allLegalMovesFor(color, b) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (colorOf(b[r][c]) === color) {
        for (const move of getLegalMoves(r, c, b, color)) {
          moves.push({ fromR: r, fromC: c, move });
        }
      }
    }
  }
  return moves;
}

function getLegalMoves(r, c, b, color) {
  return getPseudoMoves(r, c, b, color).filter((move) => {
    const test = simulateBoardMove(b, r, c, move, color);
    return !isInCheck(color, test);
  });
}

function simulateBoardMove(b, fr, fc, move, color) {
  const test = cloneBoard(b);
  const piece = test[fr][fc];
  test[move.r][move.c] = piece;
  test[fr][fc] = null;
  if (move.enPassant) test[fr][move.c] = null;
  if (move.castle) {
    const rookFrom = move.c === 6 ? 7 : 0;
    const rookTo = move.c === 6 ? 5 : 3;
    test[move.r][rookTo] = test[move.r][rookFrom];
    test[move.r][rookFrom] = null;
  }
  if (typeOf(piece) === "P" && (move.r === 0 || move.r === 7)) {
    test[move.r][move.c] = color + "Q";
  }
  return test;
}

function getPseudoMoves(r, c, b, color) {
  const piece = b[r][c];
  const type = typeOf(piece);
  const moves = [];
  const add = (rr, cc, extra = {}) => {
    if (!inside(rr, cc)) return false;
    if (!b[rr][cc]) {
      moves.push({ r: rr, c: cc, ...extra });
      return true;
    }
    if (colorOf(b[rr][cc]) !== color) moves.push({ r: rr, c: cc, ...extra });
    return false;
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const start = color === "w" ? 6 : 1;
    if (inside(r + dir, c) && !b[r + dir][c]) {
      moves.push({ r: r + dir, c });
      if (r === start && !b[r + dir * 2][c]) moves.push({ r: r + dir * 2, c });
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir,
        cc = c + dc;
      if (inside(rr, cc) && b[rr][cc] && colorOf(b[rr][cc]) !== color)
        moves.push({ r: rr, c: cc });
      if (enPassant && enPassant.r === rr && enPassant.c === cc)
        moves.push({ r: rr, c: cc, enPassant: true });
    }
  }

  if (type === "N") {
    for (const [dr, dc] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ])
      add(r + dr, c + dc);
  }

  if (type === "B" || type === "R" || type === "Q") {
    const dirs = [];
    if (type === "B" || type === "Q")
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (type === "R" || type === "Q")
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    for (const [dr, dc] of dirs) {
      let rr = r + dr,
        cc = c + dc;
      while (add(rr, cc)) {
        rr += dr;
        cc += dc;
      }
    }
  }

  if (type === "K") {
    for (const dr of [-1, 0, 1])
      for (const dc of [-1, 0, 1]) if (dr || dc) add(r + dr, c + dc);
    addCastleMoves(r, c, color, b, moves);
  }

  return moves;
}

function addCastleMoves(r, c, color, b, moves) {
  const row = color === "w" ? 7 : 0;
  if (r !== row || c !== 4 || isInCheck(color, b)) return;
  const kingSide = color + "K";
  const queenSide = color + "Q";
  if (
    castleRights[kingSide] &&
    !b[row][5] &&
    !b[row][6] &&
    !isSquareAttacked(row, 5, opposite(color), b) &&
    !isSquareAttacked(row, 6, opposite(color), b)
  ) {
    moves.push({ r: row, c: 6, castle: true });
  }
  if (
    castleRights[queenSide] &&
    !b[row][1] &&
    !b[row][2] &&
    !b[row][3] &&
    !isSquareAttacked(row, 3, opposite(color), b) &&
    !isSquareAttacked(row, 2, opposite(color), b)
  ) {
    moves.push({ r: row, c: 2, castle: true });
  }
}

function isInCheck(color, b) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] === color + "K")
        return isSquareAttacked(r, c, opposite(color), b);
    }
  }
  return false;
}

function isSquareAttacked(r, c, byColor, b) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const piece = b[rr][cc];
      if (!piece || colorOf(piece) !== byColor) continue;
      if (attacksSquare(rr, cc, r, c, b)) return true;
    }
  }
  return false;
}

function attacksSquare(fr, fc, tr, tc, b) {
  const piece = b[fr][fc];
  const color = colorOf(piece);
  const type = typeOf(piece);
  const dr = tr - fr;
  const dc = tc - fc;

  if (type === "P")
    return dr === (color === "w" ? -1 : 1) && Math.abs(dc) === 1;
  if (type === "N")
    return (
      (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
      (Math.abs(dr) === 1 && Math.abs(dc) === 2)
    );
  if (type === "K") return Math.max(Math.abs(dr), Math.abs(dc)) === 1;

  const stepR = Math.sign(dr),
    stepC = Math.sign(dc);
  const diagonal = Math.abs(dr) === Math.abs(dc);
  const straight = dr === 0 || dc === 0;
  if (
    (type === "B" && !diagonal) ||
    (type === "R" && !straight) ||
    (type === "Q" && !diagonal && !straight)
  )
    return false;

  let r = fr + stepR,
    c = fc + stepC;
  while (r !== tr || c !== tc) {
    if (b[r][c]) return false;
    r += stepR;
    c += stepC;
  }
  return true;
}

function showStatusPopup(kicker, title, message, finalState) {
  popupKicker.textContent = kicker;
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  statusPopup.classList.toggle("final", finalState);
  popupContinue.classList.toggle("hidden", finalState);
  statusPopup.classList.remove("hidden");
}

function hideStatusPopup() {
  statusPopup.classList.add("hidden");
  statusPopup.classList.remove("final");
}

function isBotTurn() {
  return gameMode === "bot" && turn === botColor && !gameOver;
}

function scheduleBotMove() {
  if (!isBotTurn()) return;
  botThinking = true;
  statusText.textContent = "Bot sedang berpikir...";
  setTimeout(
    async () => {
      const choice = chooseBotMove();
      if (choice && !gameOver) {
        await animateAndMakeMove(choice.fromR, choice.fromC, choice.move);
        afterMove();
        draw();
      }
      botThinking = false;
    },
    difficulty === "hard" ? 520 : 360,
  );
}

function chooseBotMove() {
  const moves = allLegalMoves(botColor);
  if (!moves.length) return null;
  if (difficulty === "easy") return chooseEasyMove(moves);
  if (difficulty === "normal") return chooseBestMove(moves, false);
  return chooseBestMove(moves, true);
}

function chooseEasyMove(moves) {
  const captures = moves.filter(
    (item) => board[item.move.r][item.move.c] || item.move.enPassant,
  );
  const pool = captures.length && Math.random() < 0.55 ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

function chooseBestMove(moves, lookAhead) {
  let best = moves[0];
  let bestScore = -Infinity;
  for (const item of moves) {
    const next = simulateBoardMove(
      board,
      item.fromR,
      item.fromC,
      item.move,
      botColor,
    );
    let score =
      scoreMove(item, botColor, board) +
      evaluateBoard(next, botColor) +
      Math.random() * 18;
    if (isInCheck(opposite(botColor), next)) score += 45;
    if (lookAhead) score -= bestOpponentReply(next) * 0.72;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

function bestOpponentReply(b) {
  const replies = allLegalMovesFor(opposite(botColor), b);
  if (!replies.length) return isInCheck(opposite(botColor), b) ? -99999 : 0;
  let best = -Infinity;
  for (const reply of replies) {
    const next = simulateBoardMove(
      b,
      reply.fromR,
      reply.fromC,
      reply.move,
      opposite(botColor),
    );
    const score =
      scoreMove(reply, opposite(botColor), b) +
      evaluateBoard(next, opposite(botColor));
    best = Math.max(best, score);
  }
  return best;
}

function scoreMove(item, color, b) {
  const piece = b[item.fromR][item.fromC];
  const target = item.move.enPassant
    ? b[item.fromR][item.move.c]
    : b[item.move.r][item.move.c];
  let score = 0;
  if (target)
    score += pieceValues[typeOf(target)] - pieceValues[typeOf(piece)] * 0.08;
  if (typeOf(piece) === "P" && (item.move.r === 0 || item.move.r === 7))
    score += pieceValues.Q;
  if (item.move.castle) score += 55;
  if (
    item.move.c >= 2 &&
    item.move.c <= 5 &&
    item.move.r >= 2 &&
    item.move.r <= 5
  )
    score += 12;
  if (color === "b") score += item.move.r * 2;
  if (color === "w") score += (7 - item.move.r) * 2;
  return score;
}

function evaluateBoard(b, color) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = b[r][c];
      if (!piece) continue;
      const value = pieceValues[typeOf(piece)];
      const centerBonus = 3.5 - Math.abs(3.5 - r) + (3.5 - Math.abs(3.5 - c));
      score += (colorOf(piece) === color ? 1 : -1) * (value + centerBonus * 3);
    }
  }
  return score;
}

resetGame();
