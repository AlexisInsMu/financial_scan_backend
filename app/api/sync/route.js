import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { calcularScoreSalud, calcularScoreImpacto } from '@/lib/scoreEngine';
import { validarTicketJson, validarUserId } from '@/lib/validators';
import { verificarAuth } from '@/middleware/auth';

export async function POST(request) {
  const startTime = Date.now();

  const auth = verificarAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_BODY', message: 'El cuerpo de la solicitud no es JSON válido.' },
      { status: 400 }
    );
  }

  const { ticket_json, user_id } = body;

  const userCheck = validarUserId(user_id);
  if (!userCheck.ok) return NextResponse.json(userCheck, { status: 400 });

  const jsonCheck = validarTicketJson(ticket_json);
  if (!jsonCheck.ok) return NextResponse.json(jsonCheck, { status: 422 });

  try {
    const db = await getDb();
    const ticketsCol = db.collection('tickets');
    const usersCol = db.collection('users');

    const ticketDoc = {
      user_id:         new ObjectId(user_id),
      created_at:      new Date(),
      procesado_en_ms: Date.now() - startTime,
      fuente:          'phi35_local',
      raw: {
        comercio:     ticket_json.comercio,
        fecha_ticket: ticket_json.fecha,
        total:        ticket_json.total,
      },
      productos: ticket_json.productos,
      analisis: {
        gasto_hormiga_ticket:         ticket_json.gasto_hormiga_ticket,
        ahorro_total_hormiga_mensual: ticket_json.ahorro_total_hormiga_mensual,
        mensaje_educativo:            ticket_json.mensaje_educativo,
        score_impacto:                calcularScoreImpacto(ticket_json),
      },
      metadata: {
        llm_model:      'phi-3.5-mini-local',
        prompt_version: ticket_json.prompt_version ?? 'v1.0',
      },
    };

    const { insertedId } = await ticketsCol.insertOne(ticketDoc);

    const mesActual = new Date().toISOString().slice(0, 7);
    const usuario = await usersCol.findOne({ _id: new ObjectId(user_id) });
    const ticketsMes = await ticketsCol
      .find({
        user_id:    new ObjectId(user_id),
        created_at: { $gte: new Date(`${mesActual}-01`) },
      })
      .toArray();

    const nuevoScore = calcularScoreSalud(usuario, ticketsMes);

    await usersCol.updateOne(
      { _id: new ObjectId(user_id) },
      {
        $set: {
          score_salud_ia: { ...nuevoScore, ultima_actualizacion: new Date() },
          'stats_mensuales.mes_actual':               mesActual,
          'stats_mensuales.total_escaneado':          ticketsMes.reduce((s, t) => s + t.raw.total, 0),
          'stats_mensuales.total_gasto_hormiga':      ticketsMes.reduce((s, t) => s + t.analisis.gasto_hormiga_ticket, 0),
          'stats_mensuales.tickets_escaneados':       ticketsMes.length,
          'stats_mensuales.pct_hormiga_mes_anterior': usuario?.stats_mensuales?.pct_hormiga_mes ?? nuevoScore.pct_hormiga_mes,
        },
        $inc: { tickets_totales_vida: 1 },
      }
    );

    return NextResponse.json({
      ok:              true,
      ticket_id:       insertedId,
      score: {
        valor:    nuevoScore.valor,
        nivel:    nuevoScore.nivel,
        factores: nuevoScore.factores,
      },
      procesado_en_ms: Date.now() - startTime,
    });

  } catch (err) {
    console.error('[DB Error /api/sync]', err.message);
    return NextResponse.json(
      { error: 'DB_ERROR', message: 'Error al sincronizar el ticket. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}