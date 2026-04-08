import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { verificarAuth } from '@/middleware/auth';
import { validarUserId } from '@/lib/validators';
import { generarAnalisisGeneral } from '@/lib/gemini';

export async function GET(request) {
  const auth = verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get('user_id');

  const userCheck = validarUserId(user_id);
  if (!userCheck.ok) return NextResponse.json(userCheck, { status: 400 });

  try {
    const db = await getDb();
    const ticketsCol = db.collection('tickets');
    const usersCol   = db.collection('users');

    const mesActual = new Date().toISOString().slice(0, 7);
    const usuario   = await usersCol.findOne({ _id: new ObjectId(user_id) });

    if (!usuario) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' },
        { status: 404 }
      );
    }
    
    const ticketsRecientes = await ticketsCol
    .find({ user_id: new ObjectId(user_id) })
    .sort({ created_at: -1 })
    .limit(10)
    .toArray();
    
    const analisis_general = await generarAnalisisGeneral({
      userProfile: usuario,
      ticketsRecientes: ticketsRecientes,
    });
    return NextResponse.json({
      ok: true,
      score:          usuario.score_salud_ia,
      stats_mes:      usuario.stats_mensuales,
      tickets_recientes: ticketsRecientes.map(t => ({
        id:               t._id,
        comercio:         t.raw.comercio,
        fecha:            t.raw.fecha_ticket,
        total:            t.raw.total,
        gasto_hormiga:    t.analisis.gasto_hormiga_ticket,
        mensaje_educativo: t.analisis.mensaje_educativo,
        fuente:           t.fuente,
        created_at:       t.created_at,
      })),
      estado_analsis_general: analisis_general,

    });

  } catch (err) {
    console.error('[DB Error /api/dashboard]', err.message);
    return NextResponse.json(
      { error: 'DB_ERROR', message: 'Error al obtener el dashboard.' },
      { status: 500 }
    );
  }
}