import { neon } from '@neondatabase/serverless';

// Cadena de conexión. La integración nativa de Neon en Vercel inyecta
// DATABASE_URL; también aceptamos POSTGRES_URL por compatibilidad.
const CONN = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const HAS_DB = Boolean(CONN);

const sql = HAS_DB ? neon(CONN) : null;

export type ScoreRow = {
  id: number;
  name: string;
  email: string;
  total_ms: number;
  created_at: string;
};

export type SavedScore = {
  rank: number;
  total: number;
  score: ScoreRow;
  leaderboard: ScoreRow[];
};

// ---------------------------------------------------------------------------
// Tiempos ficticios (competidores "sembrados") para que el ranking nunca
// arranque vacío. Todos por encima de 1 minuto, así un jugador real tiene
// margen para entrar al podio y sentir que puede ganar.
// ---------------------------------------------------------------------------
const SEED_SCORES: { name: string; email: string; total_ms: number }[] = [
  { name: 'Valentina', email: 'valentina@robotarena.game', total_ms: 62400 }, // 01:02.40
  { name: 'Thiago', email: 'thiago@robotarena.game', total_ms: 68900 }, //     01:08.90
  { name: 'Camila', email: 'camila@robotarena.game', total_ms: 75300 }, //     01:15.30
  { name: 'Benjamín', email: 'benjamin@robotarena.game', total_ms: 83700 }, //  01:23.70
  { name: 'Morena', email: 'morena@robotarena.game', total_ms: 91200 }, //     01:31.20
  { name: 'Lautaro', email: 'lautaro@robotarena.game', total_ms: 104600 }, //  01:44.60
  { name: 'Josefina', email: 'josefina@robotarena.game', total_ms: 118300 }, // 01:58.30
  { name: 'Bautista', email: 'bautista@robotarena.game', total_ms: 132800 }, // 02:12.80
];

// ---------------------------------------------------------------------------
// Fallback en memoria (solo para desarrollo local sin base de datos).
// Los datos NO persisten entre reinicios del servidor.
// ---------------------------------------------------------------------------
const memory: ScoreRow[] = [];
let memoryId = 1;

// Sembramos los tiempos ficticios en la memoria (modo sin base de datos).
if (!sql) {
  SEED_SCORES.forEach((s) => {
    memory.push({
      id: memoryId++,
      name: s.name,
      email: s.email,
      total_ms: s.total_ms,
      created_at: new Date().toISOString(),
    });
  });
}

let tableReady = false;
async function ensureTable() {
  if (!sql || tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS scores (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      total_ms INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // Sembramos los tiempos ficticios una sola vez, si la tabla está vacía.
  const countRows = (await sql`SELECT COUNT(*)::int AS c FROM scores;`) as { c: number }[];
  if (Number(countRows[0]?.c ?? 0) === 0) {
    for (const s of SEED_SCORES) {
      await sql`
        INSERT INTO scores (name, email, total_ms)
        VALUES (${s.name}, ${s.email}, ${s.total_ms});
      `;
    }
  }
  tableReady = true;
}

/** Devuelve el top de jugadores ordenado por menor tiempo total. */
export async function getLeaderboard(limit = 10): Promise<ScoreRow[]> {
  if (!sql) {
    return [...memory].sort((a, b) => a.total_ms - b.total_ms).slice(0, limit);
  }
  await ensureTable();
  const rows = (await sql`
    SELECT id, name, email, total_ms, created_at
    FROM scores
    ORDER BY total_ms ASC, created_at ASC
    LIMIT ${limit};
  `) as ScoreRow[];
  return rows;
}

/** Cantidad total de partidas registradas. */
export async function getTotalCount(): Promise<number> {
  if (!sql) return memory.length;
  await ensureTable();
  const rows = (await sql`SELECT COUNT(*)::int AS count FROM scores;`) as { count: number }[];
  return Number(rows[0]?.count ?? 0);
}

/** Guarda un nuevo puntaje y devuelve su posición en el ranking. */
export async function addScore(
  name: string,
  email: string,
  totalMs: number,
): Promise<SavedScore> {
  if (!sql) {
    const row: ScoreRow = {
      id: memoryId++,
      name,
      email,
      total_ms: totalMs,
      created_at: new Date().toISOString(),
    };
    memory.push(row);
    const rank = memory.filter((s) => s.total_ms < totalMs).length + 1;
    return {
      rank,
      total: memory.length,
      score: row,
      leaderboard: await getLeaderboard(10),
    };
  }

  await ensureTable();
  const inserted = (await sql`
    INSERT INTO scores (name, email, total_ms)
    VALUES (${name}, ${email}, ${totalMs})
    RETURNING id, name, email, total_ms, created_at;
  `) as ScoreRow[];
  const score = inserted[0];

  const rankRows = (await sql`
    SELECT COUNT(*)::int AS rank FROM scores WHERE total_ms < ${totalMs};
  `) as { rank: number }[];
  const rank = Number(rankRows[0]?.rank ?? 0) + 1;

  return {
    rank,
    total: await getTotalCount(),
    score,
    leaderboard: await getLeaderboard(10),
  };
}
