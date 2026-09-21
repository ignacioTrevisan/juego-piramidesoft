import { NextRequest, NextResponse } from 'next/server';
import { addScore, getLeaderboard } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/scores -> top 10 del ranking
export async function GET() {
  try {
    const leaderboard = await getLeaderboard(10);
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('GET /api/scores', err);
    return NextResponse.json({ error: 'No se pudo leer el ranking.' }, { status: 500 });
  }
}

// POST /api/scores -> guarda un puntaje { name, email, totalMs }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim();
    const totalMs = Number(body?.totalMs);

    if (!name || name.length > 60) {
      return NextResponse.json({ error: 'Nombre inválido.' }, { status: 400 });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk || email.length > 120) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 });
    }
    if (!Number.isFinite(totalMs) || totalMs <= 0 || totalMs > 1000 * 60 * 60 * 6) {
      return NextResponse.json({ error: 'Tiempo inválido.' }, { status: 400 });
    }

    const result = await addScore(name, email, Math.round(totalMs));
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/scores', err);
    return NextResponse.json({ error: 'No se pudo guardar el registro.' }, { status: 500 });
  }
}
