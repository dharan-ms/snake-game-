(() => {
  const GRID_SIZE = 20;
  const TICK_MS = 120;
  const START_LENGTH = 3;
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  const controlButtons = document.querySelectorAll("[data-dir]");

  const cellSize = canvas.width / GRID_SIZE;

  const clampDir = (current, next) => {
    if (!next || next === current) return current;
    if (OPPOSITE[current] === next) return current;
    return next;
  };

  const makeRng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };

  const initState = (seed = Date.now()) => {
    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    const snake = Array.from({ length: START_LENGTH }, (_, i) => ({
      x: startX - i,
      y: startY,
    }));
    const rng = makeRng(seed);
    const food = placeFood(snake, rng);
    return {
      snake,
      dir: "right",
      pendingDir: "right",
      food,
      score: 0,
      over: false,
      started: false,
      rng,
      tick: 0,
    };
  };

  const placeFood = (snake, rng) => {
    const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
    const open = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) open.push({ x, y });
      }
    }
    if (open.length === 0) return null;
    const idx = Math.floor(rng() * open.length);
    return open[idx];
  };

  const nextState = (state) => {
    if (state.over || !state.started) return state;

    const dir = clampDir(state.dir, state.pendingDir);
    const move = DIRECTIONS[dir];
    const head = state.snake[0];
    const next = { x: head.x + move.x, y: head.y + move.y };

    const hitWall = next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE;
    const hitSelf = state.snake.some((seg) => seg.x === next.x && seg.y === next.y);
    if (hitWall || hitSelf) {
      return { ...state, over: true, dir, pendingDir: dir };
    }

    const ate = state.food && next.x === state.food.x && next.y === state.food.y;
    const nextSnake = [next, ...state.snake];
    if (!ate) nextSnake.pop();

    const nextFood = ate ? placeFood(nextSnake, state.rng) : state.food;

    return {
      ...state,
      snake: nextSnake,
      dir,
      pendingDir: dir,
      food: nextFood,
      score: state.score + (ate ? 1 : 0),
      tick: state.tick + 1,
    };
  };

  let state = initState();
  let timer = null;
  let paused = false;

  const startLoop = () => {
    if (timer) return;
    timer = setInterval(() => {
      if (!paused) {
        state = nextState(state);
        render();
      }
    }, TICK_MS);
  };

  const setStatus = (text, isOver = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("game-over", isOver);
  };

  const renderGrid = () => {
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid");
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const p = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
      ctx.stroke();
    }
  };

  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderGrid();

    if (state.food) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--food");
      ctx.fillRect(state.food.x * cellSize, state.food.y * cellSize, cellSize, cellSize);
    }

    state.snake.forEach((seg, i) => {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
        i === 0 ? "--snake-head" : "--snake"
      );
      ctx.fillRect(seg.x * cellSize, seg.y * cellSize, cellSize, cellSize);
    });

    scoreEl.textContent = String(state.score);

    if (!state.started) {
      setStatus("Press Space to start.");
    } else if (state.over) {
      setStatus("Game over. Press Restart.", true);
    } else if (paused) {
      setStatus("Paused.");
    } else {
      setStatus("Running.");
    }
  };

  const setDirection = (dir) => {
    if (!DIRECTIONS[dir]) return;
    state = { ...state, pendingDir: clampDir(state.dir, dir) };
    if (!state.started) {
      state = { ...state, started: true };
      startLoop();
      render();
    }
  };

  const togglePause = () => {
    if (!state.started || state.over) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    render();
  };

  const restart = () => {
    state = initState();
    paused = false;
    pauseBtn.textContent = "Pause";
    startLoop();
    render();
  };

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === " " || key === "spacebar") {
      if (state.over) return;
      if (!state.started) {
        state = { ...state, started: true };
        startLoop();
        render();
      } else {
        togglePause();
      }
      return;
    }
    if (key === "r") {
      restart();
      return;
    }
    if (key === "arrowup" || key === "w") setDirection("up");
    if (key === "arrowdown" || key === "s") setDirection("down");
    if (key === "arrowleft" || key === "a") setDirection("left");
    if (key === "arrowright" || key === "d") setDirection("right");
  });

  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", restart);

  controlButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setDirection(btn.dataset.dir);
    });
  });

  render();
})();
