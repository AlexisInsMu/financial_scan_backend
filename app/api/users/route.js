import { NextResponse } from 'next/server';

// crear usuario
export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'INVALID_BODY', message: 'El cuerpo de la solicitud no es JSON válido.' },
            { status: 400 }
        );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json(
            { error: 'INVALID_BODY', message: 'El cuerpo debe ser un objeto JSON.' },
            { status: 400 }
        );
    }
    const name = body.nombre;


    if (!nombre || !email || !password_hash) {
        return NextResponse.json(
            { error: 'MISSING_FIELDS', message: 'Faltan campos requeridos: nombre, email y password_hash.' },
            { status: 422 }
        );
    }

    // genero un texto de 6 caracteres para name+randomSeed@correito.com

    // descomentar cuando realmente metamos un correo
    /*
    try {
      const db = await getDb();
      const usersCol = db.collection('users');
  
      // Verificar si el email ya existe
  
      const existingUser = await usersCol.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { error: 'EMAIL_EXISTS', message: 'El email ya está registrado.' },
          { status: 409 }
        );
      }
      */
    const randomSeed = Math.floor(Math.random() * 1000000);
    const email = `${name}${randomSeed}@correito.com`;
    const password_hash = 'hashed_password_placeholder';
    const newUser = {
        nombre: name,
        email: email,
        password_hash: password_hash,
        edad: typeof edad === 'number' ? edad : null,
        score_salud_ia: {
            valor: score_salud_ia?.valor ?? 0,
            nivel: score_salud_ia?.nivel ?? 'critico',
            ultima_actualizacion: score_salud_ia?.ultima_actualizacion
                ? new Date(score_salud_ia.ultima_actualizacion)
                : new Date(),
            factores: score_salud_ia?.factores ?? {},
        },
        stats_mensuales: {
            mes_actual: stats_mensuales?.mes_actual ?? new Date().toISOString().slice(0, 7),
            total_escaneado: stats_mensuales?.total_escaneado ?? 0,
            total_gasto_hormiga: stats_mensuales?.total_gasto_hormiga ?? 0,
            ahorro_proyectado: stats_mensuales?.ahorro_proyectado ?? 0,
            tickets_escaneados: stats_mensuales?.tickets_escaneados ?? 0,
        },
        tickets_totales_vida: body.tickets_totales_vida ?? 0,
        created_at: created_at ? new Date(created_at) : new Date(),
    };

    const { insertedId } = await usersCol.insertOne(newUser);

    try {
        return NextResponse.json({ user_id: insertedId.toString() }, { status: 201 });
    } catch (err) {
        console.error('[DB Error /api/users]', err.message);
        return NextResponse.json(
            { error: 'DB_ERROR', message: 'Error al crear el usuario. Intenta de nuevo.' },
            { status: 500 }
        );
    }
}

