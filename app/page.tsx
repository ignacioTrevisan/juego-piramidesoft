'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Datos del negocio para el cupón (editá esto libremente).
// ---------------------------------------------------------------------------
const PROMO = {
  academy: 'Pirámide Academy',
  offer: 'una clase gratis de programación',
  address: 'Gouchon 341',
  validityDays: 15,
  instagram: 'piramide.academy.ok',
  instagramUrl: 'https://instagram.com/piramide.academy.ok',
  whatsapp: '+54 9 3447 46-5675',
  whatsappUrl: 'https://wa.me/5493447465675',
};

// Genera un código de cupón corto y legible (sin caracteres confusos).
function makeCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `RA-${s}`;
}

// ---------------------------------------------------------------------------
// Configuración de niveles: la grilla crece para subir la dificultad.
// ---------------------------------------------------------------------------
type Dir = 'N' | 'E' | 'S' | 'W';
type Pos = { r: number; c: number };
type Level = {
  size: number;
  start: Pos & { dir: Dir };
  goal: Pos;
  walls: Pos[];
  // Si es true, la meta se sortea al empezar el nivel (respetando minDist).
  randomGoal?: boolean;
  // Distancia mínima (en casilleros) entre inicio y meta: evita que la meta
  // aparezca pegada al robot y garantiza un mínimo de movimientos.
  minDist?: number;
};

const LEVELS: Level[] = [
  {
    // Nivel 1: fijo, siempre igual (introducción).
    size: 3,
    start: { r: 2, c: 0, dir: 'E' },
    goal: { r: 0, c: 2 },
    walls: [],
  },
  {
    // Nivel 2: meta aleatoria, al menos 3 casilleros de distancia.
    size: 4,
    start: { r: 3, c: 0, dir: 'E' },
    goal: { r: 0, c: 3 },
    walls: [
      { r: 2, c: 1 },
      { r: 1, c: 2 },
    ],
    randomGoal: true,
    minDist: 3,
  },
  {
    // Nivel 3: meta aleatoria, al menos 5 casilleros de distancia.
    size: 5,
    start: { r: 4, c: 0, dir: 'N' },
    goal: { r: 0, c: 4 },
    walls: [
      { r: 3, c: 1 },
      { r: 2, c: 1 },
      { r: 1, c: 3 },
      { r: 3, c: 3 },
    ],
    randomGoal: true,
    minDist: 5,
  },
];

// --- Utilidades para sortear la meta ---
const key = (p: Pos) => `${p.r},${p.c}`;
const manhattan = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

// Casilleros alcanzables desde el inicio (evitando muros y bordes).
function reachableCells(size: number, start: Pos, walls: Set<string>): Set<string> {
  const seen = new Set<string>([key(start)]);
  const queue: Pos[] = [start];
  const dirs = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of dirs) {
      const nr = cur.r + d.r;
      const nc = cur.c + d.c;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const k = `${nr},${nc}`;
      if (seen.has(k) || walls.has(k)) continue;
      seen.add(k);
      queue.push({ r: nr, c: nc });
    }
  }
  return seen;
}

// Elige una meta aleatoria alcanzable y suficientemente lejos del inicio.
function pickGoal(base: Level): Pos {
  const { size, start, walls } = base;
  const wallSet = new Set(walls.map(key));
  const reach = reachableCells(size, start, wallSet);
  let minDist = base.minDist ?? 2;

  while (minDist >= 2) {
    const candidates: Pos[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = { r, c };
        if (r === start.r && c === start.c) continue;
        if (wallSet.has(key(cell))) continue;
        if (!reach.has(key(cell))) continue;
        if (manhattan(start, cell) < minDist) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    minDist--; // si no hay candidatos, relajamos la distancia mínima
  }
  return base.goal; // fallback (no debería ocurrir)
}

// Construye los 3 niveles concretos: el 1 fijo, el 2 y 3 con meta sorteada.
function buildLevels(): Level[] {
  return LEVELS.map((base) => (base.randomGoal ? { ...base, goal: pickGoal(base) } : { ...base }));
}

type Command = 'forward' | 'left' | 'right';

const CMD_META: Record<Command, { label: string; glyph: string }> = {
  forward: { label: 'Avanzar', glyph: '▲' },
  left: { label: 'Izquierda', glyph: '↺' },
  right: { label: 'Derecha', glyph: '↻' },
};

const DELTA: Record<Dir, Pos> = {
  N: { r: -1, c: 0 },
  E: { r: 0, c: 1 },
  S: { r: 1, c: 0 },
  W: { r: 0, c: -1 },
};

const RIGHT: Record<Dir, Dir> = { N: 'E', E: 'S', S: 'W', W: 'N' };
const LEFT: Record<Dir, Dir> = { N: 'W', W: 'S', S: 'E', E: 'N' };
const ROT: Record<Dir, number> = { N: 0, E: 90, S: 180, W: 270 };

type Phase = 'intro' | 'playing' | 'finished';

type ScoreRow = {
  id: number;
  name: string;
  email: string;
  total_ms: number;
  created_at: string;
};

function fmtTime(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
function fmtDelta(ms: number) {
  const sign = ms >= 0 ? '+' : '-';
  return sign + fmtTime(Math.abs(ms));
}

const sameCell = (a: Pos, b: Pos) => a.r === b.r && a.c === b.c;

export default function Page() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [showHelp, setShowHelp] = useState(true); // el instructivo se abre al inicio
  const [levelIdx, setLevelIdx] = useState(0);
  // Niveles concretos de la partida. Se inicializa con la config estática
  // (determinista, evita mismatch de hidratación); se sortean las metas al
  // presionar "Empezar".
  const [levels, setLevels] = useState<Level[]>(LEVELS);
  const level = levels[levelIdx];

  const [robot, setRobot] = useState({ ...level.start });
  const [program, setProgram] = useState<Command[]>([]);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [message, setMessage] = useState<{ text: string; kind: 'good' | 'bad' } | null>(null);
  const [crashed, setCrashed] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const [finalMs, setFinalMs] = useState(0);

  const [leaderboard, setLeaderboard] = useState<ScoreRow[]>([]);
  const bestMs = leaderboard[0]?.total_ms;

  const wallSet = useMemo(() => new Set(level.walls.map((w) => `${w.r},${w.c}`)), [level]);

  // Cargar ranking al inicio
  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/scores', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard);
    } catch {
      /* ignorado: puede no haber base todavía */
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Cronómetro (setInterval: sigue corriendo aunque la pestaña pase a segundo
  // plano; el tiempo real siempre se calcula con Date.now()).
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 50);
    return () => clearInterval(id);
  }, [phase]);

  const resetRobot = useCallback((lvl: Level) => {
    setRobot({ ...lvl.start });
    setCrashed(false);
    setActiveStep(-1);
  }, []);

  const startGame = () => {
    const built = buildLevels(); // sortea las metas de los niveles 2 y 3
    setLevels(built);
    setLevelIdx(0);
    resetRobot(built[0]);
    setProgram([]);
    setMessage(null);
    setElapsed(0);
    setShowHelp(false);
    startRef.current = Date.now();
    setPhase('playing');
  };

  const addCmd = (cmd: Command) => {
    if (running) return;
    setMessage(null);
    setProgram((p) => (p.length >= 40 ? p : [...p, cmd]));
  };
  const removeStep = (i: number) => {
    if (running) return;
    setProgram((p) => p.filter((_, idx) => idx !== i));
  };
  const clearProgram = () => {
    if (running) return;
    setProgram([]);
    setMessage(null);
    resetRobot(level);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const run = async () => {
    if (running || program.length === 0) return;
    setRunning(true);
    setMessage(null);
    let state = { ...level.start };
    setRobot({ ...state });
    setCrashed(false);
    await sleep(250);

    for (let i = 0; i < program.length; i++) {
      setActiveStep(i);
      const cmd = program[i];
      if (cmd === 'left' || cmd === 'right') {
        state = { ...state, dir: cmd === 'left' ? LEFT[state.dir] : RIGHT[state.dir] };
        setRobot({ ...state });
      } else {
        const d = DELTA[state.dir];
        const nr = state.r + d.r;
        const nc = state.c + d.c;
        const out = nr < 0 || nc < 0 || nr >= level.size || nc >= level.size;
        const wall = wallSet.has(`${nr},${nc}`);
        if (out || wall) {
          setCrashed(true);
          setMessage({
            text: out
              ? 'El robot se salió del tablero. Corregí la secuencia.'
              : 'El robot chocó un obstáculo. Corregí la secuencia.',
            kind: 'bad',
          });
          await sleep(500);
          setActiveStep(-1);
          setRunning(false);
          return;
        }
        state = { ...state, r: nr, c: nc };
        setRobot({ ...state });
      }
      await sleep(340);
    }
    setActiveStep(-1);

    if (sameCell(state, level.goal)) {
      if (levelIdx < LEVELS.length - 1) {
        setMessage({ text: 'Nivel superado. Preparando el siguiente…', kind: 'good' });
        await sleep(850);
        const next = levelIdx + 1;
        setLevelIdx(next);
        resetRobot(levels[next]);
        setProgram([]);
        setMessage(null);
        setRunning(false);
      } else {
        const total = Date.now() - startRef.current;
        setFinalMs(total);
        setElapsed(total);
        await sleep(500);
        setRunning(false);
        setPhase('finished');
      }
    } else {
      setMessage({
        text: 'El robot no llegó a la meta. Revisá los pasos e intentá de nuevo.',
        kind: 'bad',
      });
      setRunning(false);
    }
  };

  const behind = phase === 'playing' && bestMs != null && elapsed > bestMs;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <span className="mark" />
          <div>
            <div className="name">ROBOT ARENA</div>
            <div className="sub">Programá · Compite · Gana</div>
          </div>
        </div>
        <div className="stats">
          <div className="chip">
            <span className="k">Nivel</span>
            <span className="v">
              {phase === 'finished' ? 'OK' : levelIdx + 1}/{LEVELS.length}
            </span>
          </div>
          <div className="chip">
            <span className="k">Grilla</span>
            <span className="v tnum">
              {level.size}×{level.size}
            </span>
          </div>
          <div className={`chip timer${behind ? ' behind' : ''}`}>
            <span className="k">{behind ? 'Vas perdiendo' : 'Tiempo'}</span>
            <span className="v tnum">{fmtTime(phase === 'finished' ? finalMs : elapsed)}</span>
          </div>
          {phase !== 'intro' && (
            <button className="help-btn" onClick={() => setShowHelp(true)}>
              ¿Cómo se juega?
            </button>
          )}
        </div>
      </div>

      {phase === 'playing' && <PodiumBar rows={leaderboard} />}

      {phase === 'intro' && (
        <IntroBoard onOpen={() => setShowHelp(true)} />
      )}

      {phase === 'playing' && (
        <div className="arena">
          <div className="col-board">
            <div className="card">
              <div className="board-head">
                <span className="lvl">Nivel {levelIdx + 1}</span>
                <span className="goalhint">Llevá el robot a la diana dorada</span>
              </div>
              <div className="board-wrap">
                <Board level={level} robot={robot} crashed={crashed} wallSet={wallSet} />
              </div>
              <div className="legend">
                <div className="li">
                  <span className="swatch">
                    <span className="robot" style={{ width: '70%', height: '70%' }}>
                      <span className="chevron" />
                    </span>
                  </span>
                  Robot (la punta marca el frente)
                </div>
                <div className="li">
                  <span className="swatch">
                    <span className="goal-mark" style={{ animation: 'none' }} />
                  </span>
                  Meta
                </div>
              </div>
            </div>
          </div>

          <div className="col-controls">
            <div className="card">
              <p className="card-title">
                Secuencia <span className="tag">{program.length} pasos</span>
              </p>
              <div className="palette">
                <button className="btn" disabled={running} onClick={() => addCmd('forward')}>
                  <span className="glyph">▲</span> Avanzar
                </button>
                <button className="btn" disabled={running} onClick={() => addCmd('left')}>
                  <span className="glyph">↺</span> Izquierda
                </button>
                <button className="btn" disabled={running} onClick={() => addCmd('right')}>
                  <span className="glyph">↻</span> Derecha
                </button>
                <button
                  className="btn clear"
                  disabled={running || program.length === 0}
                  onClick={clearProgram}
                >
                  Borrar
                </button>
              </div>

              <div className="program">
                {program.map((cmd, i) => (
                  <span
                    key={i}
                    className={`step${activeStep === i ? ' active' : ''}`}
                    title="Click para quitar este paso"
                    onClick={() => removeStep(i)}
                  >
                    <span className="idx">{i + 1}</span>
                    {CMD_META[cmd].glyph}
                  </span>
                ))}
              </div>

              <button
                className="btn run wide"
                disabled={running || program.length === 0}
                onClick={run}
              >
                {running ? 'Ejecutando…' : 'Ejecutar'}
              </button>

              {message && <div className={`msg ${message.kind}`}>{message.text}</div>}

              <p className="hint" style={{ marginTop: 12 }}>
                Tocá un paso de la secuencia para eliminarlo. El cronómetro no se detiene entre
                niveles.
              </p>
            </div>
          </div>

          <div className="col-rank">
            <div className="card" style={{ height: '100%' }}>
              <p className="card-title">
                Ranking <span className="tag">en vivo</span>
              </p>
              <RankTarget bestMs={bestMs} best={leaderboard[0]} elapsed={elapsed} />
              <Leaderboard rows={leaderboard} />
            </div>
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <FinalScreen
          finalMs={finalMs}
          leaderboard={leaderboard}
          onSaved={loadLeaderboard}
          onRetry={startGame}
        />
      )}

      {showHelp && (
        <HowToPlay
          best={leaderboard[0]}
          started={phase !== 'intro'}
          onStart={startGame}
          onClose={() => setShowHelp(false)}
        />
      )}

      <footer className="footer-note">
        <div className="footer-credit">
          Un juego de <strong>{PROMO.academy}</strong>
        </div>
        <div className="footer-links">
          <a href={PROMO.instagramUrl} target="_blank" rel="noreferrer">
            @{PROMO.instagram}
          </a>
          <span className="sep">·</span>
          <a href={PROMO.whatsappUrl} target="_blank" rel="noreferrer">
            WhatsApp {PROMO.whatsapp}
          </a>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla de fondo del intro (tablero de muestra detrás del modal)
// ---------------------------------------------------------------------------
function IntroBoard({ onOpen }: { onOpen: () => void }) {
  const demo = LEVELS[1];
  const wallSet = new Set(demo.walls.map((w) => `${w.r},${w.c}`));
  return (
    <div className="arena">
      <div className="col-board">
        <div className="card">
          <div className="board-head">
            <span className="lvl">Vista previa</span>
            <button className="help-btn" onClick={onOpen}>
              Ver instrucciones
            </button>
          </div>
          <div className="board-wrap">
            <Board level={demo} robot={demo.start} crashed={false} wallSet={wallSet} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tablero
// ---------------------------------------------------------------------------
function Board({
  level,
  robot,
  crashed,
  wallSet,
}: {
  level: Level;
  robot: Pos & { dir: Dir };
  crashed: boolean;
  wallSet: Set<string>;
}) {
  const cells = [];
  for (let r = 0; r < level.size; r++) {
    for (let c = 0; c < level.size; c++) {
      const isGoal = sameCell(level.goal, { r, c });
      const isWall = wallSet.has(`${r},${c}`);
      const isRobot = robot.r === r && robot.c === c;
      const isStart = level.start.r === r && level.start.c === c;
      cells.push(
        <div
          key={`${r}-${c}`}
          className={`cell${isWall ? ' wall' : ''}${isGoal ? ' goal' : ''}${
            isStart && !isRobot ? ' start-mark' : ''
          }`}
        >
          {isGoal && !isRobot && <span className="goal-mark" />}
          {isRobot && (
            <div
              className={`robot${crashed ? ' crashed' : ''}`}
              style={{ transform: `rotate(${ROT[robot.dir]}deg)` }}
            >
              <span className="chevron" />
            </div>
          )}
        </div>,
      );
    }
  }
  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${level.size}, 1fr)`,
        width: 'min(100%, 400px)',
      }}
    >
      {cells}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objetivo a batir (parte superior del ranking)
// ---------------------------------------------------------------------------
function RankTarget({
  bestMs,
  best,
  elapsed,
}: {
  bestMs?: number;
  best?: ScoreRow;
  elapsed: number;
}) {
  if (bestMs == null || !best) {
    return (
      <div className="rank-target">
        <div className="lab">Récord</div>
        <div className="who">Todavía nadie marcó tiempo.</div>
        <div className="t">¡Sé el primero!</div>
      </div>
    );
  }
  const diff = elapsed - bestMs;
  const showDelta = elapsed > 0;
  return (
    <div className="rank-target">
      <div className="lab">Tiempo a batir · Líder</div>
      <div className="who">{best.name}</div>
      <div className="t tnum">{fmtTime(bestMs)}</div>
      {showDelta && (
        <div className={`delta ${diff > 0 ? 'behind' : 'ahead'} tnum`}>
          {diff > 0
            ? `Vas ${fmtDelta(diff)} — ¡acelerá!`
            : `Le ganás por ${fmtTime(-diff)}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra compacta Top 3 (visible solo en móvil, fija arriba mientras se juega)
// ---------------------------------------------------------------------------
function PodiumBar({ rows }: { rows: ScoreRow[] }) {
  if (!rows.length) return null;
  const top = rows.slice(0, 3);
  return (
    <div className="podium-bar">
      <span className="pb-title">Top 3 · tiempos a batir</span>
      <div className="pb-list">
        {top.map((r, i) => (
          <div key={r.id} className="pb-item">
            <span className={`pb-pos p${i + 1}`}>{i + 1}</span>
            <span className="pb-meta">
              <span className="pb-name">{r.name}</span>
              <span className="pb-time tnum">{fmtTime(r.total_ms)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla de ranking
// ---------------------------------------------------------------------------
function Leaderboard({ rows, myId }: { rows: ScoreRow[]; myId?: number }) {
  if (rows.length === 0) {
    return (
      <div className="lb-empty">
        Aún no hay tiempos registrados.
        <br />
        El primero en terminar encabeza la tabla.
      </div>
    );
  }
  return (
    <div className="lb">
      {rows.map((row, i) => (
        <div key={row.id} className={`lb-row${row.id === myId ? ' me' : ''}`}>
          <span className={`lb-pos${i < 3 ? ` p${i + 1}` : ''}`}>{i + 1}</span>
          <span className="lb-name">{row.name}</span>
          <span className="lb-time tnum">{fmtTime(row.total_ms)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal instructivo
// ---------------------------------------------------------------------------
function HowToPlay({
  best,
  started,
  onStart,
  onClose,
}: {
  best?: ScoreRow;
  started: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={started ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="kicker">El juego</div>
        <h2>Llevá el robot a la meta</h2>
        <p className="lead">
          Armá la secuencia de movimientos y tocá <b>Ejecutar</b>. Son 3 niveles y el cronómetro
          corre siempre: <b>gana el mejor tiempo</b>.
        </p>

        <div className="cmd-row">
          <span className="cmd"><span className="g">▲</span> Avanzar</span>
          <span className="cmd"><span className="g">↺</span> Girar izq.</span>
          <span className="cmd"><span className="g">↻</span> Girar der.</span>
        </div>

        {best && (
          <div className="record-banner">
            <div className="lab">Récord a batir</div>
            <div className="val tnum">{fmtTime(best.total_ms)}</div>
            <div className="cta">
              Lo tiene <b>{best.name}</b>. ¿Podés superarlo?
            </div>
          </div>
        )}

        {started ? (
          <button className="btn run wide" onClick={onClose}>
            Volver al juego
          </button>
        ) : (
          <button className="btn run wide" onClick={onStart}>
            Empezar a competir
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla final: tiempo, registro y ranking
// ---------------------------------------------------------------------------
function FinalScreen({
  finalMs,
  leaderboard,
  onSaved,
  onRetry,
}: {
  finalMs: number;
  leaderboard: ScoreRow[];
  onSaved: () => void;
  onRetry: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [result, setResult] = useState<{
    rank: number;
    total: number;
    myId: number;
    leaderboard: ScoreRow[];
  } | null>(null);

  // Puesto provisorio (antes de registrar) para dar el gancho competitivo
  const provisionalRank = leaderboard.filter((s) => s.total_ms < finalMs).length + 1;
  const aheadRow = leaderboard[provisionalRank - 2]; // el que está justo arriba

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Ingresá tu nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError('Ingresá un correo válido.');

    setSaving(true);
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), totalMs: finalMs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar.');
      setCoupon(makeCouponCode());
      setResult({
        rank: data.rank,
        total: data.total,
        myId: data.score.id,
        leaderboard: data.leaderboard,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="final">
        <div className="kicker">Desafío completado</div>
        <div className="time-hero tnum">{fmtTime(finalMs)}</div>
        <p className="hint">Tiempo total de los 3 niveles</p>

        {!result ? (
          <>
            <div className="rank-reveal">
              <span className="small">Puesto provisorio</span>
              <span className="big">#{provisionalRank}</span>
            </div>
            {aheadRow && (
              <p className="chase tnum">
                Estás a <b>{fmtTime(finalMs - aheadRow.total_ms)}</b> del puesto #
                {provisionalRank - 1} ({aheadRow.name}).
              </p>
            )}
            <form className="form" onSubmit={submit}>
              <p className="hint" style={{ textAlign: 'center' }}>
                Registrá tu nombre y correo para <b>confirmar tu puesto</b> en el ranking.
              </p>
              <div>
                <label htmlFor="name">Nombre</label>
                <input
                  id="name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  maxLength={120}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                />
              </div>
              {error && <div className="msg bad">{error}</div>}
              <button className="btn run wide" type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Confirmar mi puesto'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="coupon">
              <div className="coupon-top">
                <span className="coupon-badge">Cupón</span>
                <span className="coupon-brand">{PROMO.academy}</span>
              </div>
              <div className="coupon-title">¡Ganaste {PROMO.offer}!</div>
              <div className="coupon-sub">
                {name.trim()} · {fmtTime(finalMs)} · Puesto #{result.rank}
              </div>

              <div className="coupon-perf" />

              <div className="coupon-instructions">
                Acercate a <b>{PROMO.address}</b> mostrando <b>una captura de esta pantalla</b> y
                reclamá tu clase gratis.
              </div>
              <div className="coupon-code">
                <span className="lab">Código</span>
                <span className="val tnum">{coupon}</span>
              </div>
              <div className="coupon-foot">
                Válido {PROMO.validityDays} días · Un cupón por persona · Presentar esta captura
              </div>

              <a
                className="coupon-ig"
                href={PROMO.instagramUrl}
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="17.4" cy="6.6" r="1.4" fill="currentColor" />
                </svg>
                <span className="coupon-ig-text">
                  <span className="coupon-ig-lab">Seguinos en Instagram</span>
                  <span className="coupon-ig-handle">@{PROMO.instagram}</span>
                </span>
              </a>

              <div className="coupon-contact">
                ¿Consultas? Escribinos al WhatsApp{' '}
                <a href={PROMO.whatsappUrl} target="_blank" rel="noreferrer">
                  {PROMO.whatsapp}
                </a>
              </div>
            </div>

            <p className="capture-hint">
              Sacale una captura a esta pantalla para no perder tu cupón.
            </p>

            <div className="rank-reveal">
              <span className="small">Quedaste en el puesto</span>
              <span className="big">#{result.rank}</span>
              <span className="small">de {result.total}</span>
            </div>
            <p className="chase">
              {result.rank === 1
                ? '¡Sos el número 1 del ranking! Nadie te superó.'
                : `Estás en el top ${Math.max(
                    1,
                    Math.round((result.rank / result.total) * 100),
                  )}%. Volvé a jugar y escalá posiciones.`}
            </p>

            <div className="final-lb">
              <p className="card-title" style={{ marginBottom: 10 }}>
                Ranking <span className="tag">Top {result.leaderboard.length}</span>
              </p>
              <Leaderboard rows={result.leaderboard} myId={result.myId} />
            </div>

            <button className="btn ghost wide" style={{ marginTop: 18 }} onClick={onRetry}>
              Jugar de nuevo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
