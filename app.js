(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const ctx = canvas.getContext('2d');

  let cellSize = 12, cols = 0, rows = 0;
  let grid = new Uint8Array(0), next = new Uint8Array(0);
  let running = false, generation = 0, speed = 10, lastStep = 0;
  let wrap = true, showGrid = true;

  // ---------- Grid sizing ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nc = Math.max(1, Math.floor(w / cellSize));
    const nr = Math.max(1, Math.floor(h / cellSize));
    const ng = new Uint8Array(nc * nr);
    for (let y = 0; y < Math.min(rows, nr); y++) {
      for (let x = 0; x < Math.min(cols, nc); x++) {
        ng[y * nc + x] = grid[y * cols + x];
      }
    }
    cols = nc;
    rows = nr;
    grid = ng;
    next = new Uint8Array(nc * nr);
    draw();
  }

  // ---------- Simulation ----------
  function step() {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            let nx = x + dx, ny = y + dy;
            if (wrap) {
              nx = (nx + cols) % cols;
              ny = (ny + rows) % rows;
            } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
              continue;
            }
            n += grid[ny * cols + nx];
          }
        }
        const i = y * cols + x;
        next[i] = grid[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
    }
    [grid, next] = [next, grid];
    generation++;
  }

  function randomize() {
    const d = +$('density').value / 100;
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < d ? 1 : 0;
    }
    generation = 0;
    draw();
  }

  function clear() {
    grid.fill(0);
    generation = 0;
    draw();
  }

  // ---------- Rendering ----------
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const gap = cellSize > 5 ? 1 : 0;
    let pop = 0;
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!grid[y * cols + x]) continue;
        pop++;
        ctx.fillRect(x * cellSize + gap, y * cellSize + gap, cellSize - gap, cellSize - gap);
      }
    }

    if (showGrid && cellSize >= 6) {
      ctx.strokeStyle = '#161616';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        ctx.moveTo(x * cellSize + 0.5, 0);
        ctx.lineTo(x * cellSize + 0.5, rows * cellSize);
      }
      for (let y = 0; y <= rows; y++) {
        ctx.moveTo(0, y * cellSize + 0.5);
        ctx.lineTo(cols * cellSize, y * cellSize + 0.5);
      }
      ctx.stroke();
    }

    $('gen').textContent = generation;
    $('pop').textContent = pop;
  }

  // ---------- Main loop (fixed timestep) ----------
  function loop(ts) {
    if (running) {
      const interval = 1000 / speed;
      if (ts - lastStep >= interval) {
        let steps = 0;
        while (ts - lastStep >= interval && steps < 4) {
          step();
          lastStep += interval;
          steps++;
        }
        if (ts - lastStep >= interval) lastStep = ts;
        draw();
      }
    }
    requestAnimationFrame(loop);
  }

  function setRunning(r) {
    running = r;
    lastStep = performance.now();
    const b = $('playBtn');
    $('playIcon').hidden = r;
    $('pauseIcon').hidden = !r;
    b.classList.toggle('running', r);
    b.setAttribute('aria-label', r ? 'Pause' : 'Play');
  }

  // ---------- Cell editing ----------
  let painting = false, paintValue = 1;
  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cellSize);
    const y = Math.floor((e.clientY - r.top) / cellSize);
    return x >= 0 && y >= 0 && x < cols && y < rows ? y * cols + x : -1;
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    const i = cellAt(e);
    if (i < 0) return;
    canvas.setPointerCapture(e.pointerId);
    painting = true;
    paintValue = e.button === 2 ? 0 : grid[i] ? 0 : 1;
    grid[i] = paintValue;
    draw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const i = cellAt(e);
    if (i >= 0 && grid[i] !== paintValue) {
      grid[i] = paintValue;
      draw();
    }
  });

  const stop = () => (painting = false);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  // ---------- Patterns ----------
  const PATTERNS = {
    glider: ['.O.', '..O', 'OOO'],
    lwss: ['.O..O', 'O....', 'O...O', 'OOOO.'],
    rpent: ['.OO', 'OO.', '.O.'],
    pulsar: [
      '..OOO...OOO..', '.............', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O',
      '..OOO...OOO..', '.............', '..OOO...OOO..', 'O....O.O....O', 'O....O.O....O',
      'O....O.O....O', '.............', '..OOO...OOO..'],
    gun: [
      '........................O...........', '......................O.O...........',
      '............OO......OO............OO', '...........O...O....OO............OO',
      'OO........O.....O...OO..............', 'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........', '...........O...O....................',
      '............OO......................'],
  };

  function placePattern(name) {
    const p = PATTERNS[name];
    if (!p) return;
    const ox = Math.floor((cols - p[0].length) / 2);
    const oy = Math.floor((rows - p.length) / 2);
    p.forEach((row, y) => [...row].forEach((c, x) => {
      const gx = ox + x, gy = oy + y;
      if (c === 'O' && gx >= 0 && gy >= 0 && gx < cols && gy < rows) {
        grid[gy * cols + gx] = 1;
      }
    }));
    draw();
  }

  // ---------- Controls ----------
  $('playBtn').onclick = () => setRunning(!running);
  $('stepBtn').onclick = () => { setRunning(false); step(); draw(); };
  $('randomBtn').onclick = randomize;
  $('clearBtn').onclick = () => { setRunning(false); clear(); };
  $('speed').oninput = (e) => { speed = +e.target.value; $('speedVal').textContent = speed; };
  $('density').oninput = (e) => ($('densityVal').textContent = e.target.value);
  $('cellSize').oninput = (e) => { cellSize = +e.target.value; $('sizeVal').textContent = cellSize; resize(); };
  $('wrap').onchange = (e) => (wrap = e.target.checked);
  $('grid').onchange = (e) => { showGrid = e.target.checked; draw(); };
  $('pattern').onchange = (e) => { placePattern(e.target.value); e.target.value = ''; };

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setRunning(!running); }
    else if (k === 's') $('stepBtn').click();
    else if (k === 'r') randomize();
    else if (k === 'c') $('clearBtn').click();
  });

  new ResizeObserver(resize).observe(canvas);
  resize();
  randomize();
  requestAnimationFrame(loop);
})();
