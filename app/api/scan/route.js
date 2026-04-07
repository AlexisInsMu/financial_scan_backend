import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { procesarTicketConGemini, PROMPT_VER } from '@/lib/gemini';
import { calcularScoreSalud, calcularScoreImpacto } from '@/lib/scoreEngine';
import { validarOcrText, validarUserId } from '@/lib/validators';
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

  // Si no envían tipo_de_peticion, asumimos 0 (escaneo de ticket)
  const { texto, ocr_text, tipo_de_peticion = 0, user_id } = body;
  
  const textoEntrada = texto || ocr_text;

  const userCheck = validarUserId(user_id);
  if (!userCheck.ok) return NextResponse.json(userCheck, { status: 400 });

  if (!textoEntrada || textoEntrada.trim() === '') {
    return NextResponse.json(
      { error: 'EMPTY_TEXT', message: 'El texto no puede estar vacío.' }, 
      { status: 422 }
    );
  }

  if (tipo_de_peticion === 0) { // ticket
    const ocrCheck = validarOcrText(textoEntrada);
    if (!ocrCheck.ok) return NextResponse.json(ocrCheck, { status: 422 });
  } else if (textoEntrada.trim().length < 5) { // voz, pero con un mínimo de caracteres para evitar procesar audios sin información útil
    return NextResponse.json(
      { error: 'VOICE_TOO_SHORT', message: 'El audio transcrito es muy corto para procesarlo.' }, 
      { status: 422 }
    );
  }

  let ticketData;
  try {
    ticketData = await procesarTicketConGemini(textoEntrada, tipo_de_peticion); // Gemini 
  } catch (err) {
    console.error('[Gemini Error]', err.message);
    return NextResponse.json(
      { error: 'LLM_ERROR', message: 'No se pudo interpretar el gasto. Intenta de nuevo.' },
      { status: 502 }
    );
  }

  try {
    const db = await getDb();
    const ticketsCol = db.collection('tickets');
    const usersCol = db.collection('users');

    // Determinamos la fuente para saber si fue OCR o Voz
    const fuenteGasto = tipo_de_peticion === 1 ? 'dictado_voz' : 'gemini_cloud';

    const ticketDoc = {
      user_id:         new ObjectId(user_id),
      created_at:      new Date(),
      procesado_en_ms: Date.now() - startTime,
      fuente:          fuenteGasto,
      raw: {
        comercio:     ticketData.comercio,
        fecha_ticket: ticketData.fecha,
        total:        ticketData.total,
        texto_original: textoEntrada 
      },
      productos: ticketData.productos,
      analisis: {
        gasto_hormiga_ticket:         ticketData.gasto_hormiga_ticket,
        ahorro_total_hormiga_mensual: ticketData.ahorro_total_hormiga_mensual,
        mensaje_educativo:            ticketData.mensaje_educativo,
        score_impacto:                calcularScoreImpacto(ticketData),
      },
      metadata: {
        llm_model: 'gemini-2.5-flash',
        prompt_version: PROMPT_VER,
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
          'stats_mensuales.mes_actual':                mesActual,
          'stats_mensuales.total_escaneado':           ticketsMes.reduce((s, t) => s + t.raw.total, 0),
          'stats_mensuales.total_gasto_hormiga':       ticketsMes.reduce((s, t) => s + t.analisis.gasto_hormiga_ticket, 0),
          'stats_mensuales.tickets_escaneados':        ticketsMes.length,
          'stats_mensuales.pct_hormiga_mes_anterior':  usuario?.stats_mensuales?.pct_hormiga_mes ?? nuevoScore.pct_hormiga_mes,
        },
        $inc: { tickets_totales_vida: 1 },
      }
    );

    return NextResponse.json({
      ok: true,
      ticket: {
        id:                insertedId,
        comercio:          ticketData.comercio,
        fecha:             ticketData.fecha,
        total:             ticketData.total,
        productos:         ticketData.productos,
        gasto_hormiga:     ticketData.gasto_hormiga_ticket,
        ahorro_proyectado: ticketData.ahorro_total_hormiga_mensual,
        mensaje_educativo: ticketData.mensaje_educativo,
        fuente:            fuenteGasto
      },
      score: {
        valor:    nuevoScore.valor,
        nivel:    nuevoScore.nivel,
        factores: nuevoScore.factores,
      },
      procesado_en_ms: Date.now() - startTime,
    });

  } catch (err) {
    console.error('[DB Error /api/scan]', err.message);
    return NextResponse.json(
      { error: 'DB_ERROR', message: 'Error al guardar el ticket. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}