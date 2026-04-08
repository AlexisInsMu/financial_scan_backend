import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

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


    // genero un texto de 6 caracteres para name+randomSeed@correito.com

    const randomSeed = Math.floor(Math.random() * 1000000);
    const email = `${name}${randomSeed}@correito.com`;
    const password_hash = 'hashed_password_placeholder';
    const newUser = {
        nombre: name,
        email,
        password_hash: 'hashed_password_placeholder',
        edad: null,
        score_salud_ia: {
            valor: 100,
            nivel: 'excelente',
            ultima_actualizacion: new Date(),
            factores: {},
        },
        stats_mensuales: {
            mes_actual: new Date().toISOString().slice(0, 7),
            total_escaneado: 0,
            total_gasto_hormiga: 0,
            ahorro_proyectado: 0,
            tickets_escaneados: 0,
        },
        tickets_totales_vida: 0,
        created_at: new Date(),
    };

    try {
        const db = await getDb();
        const usersCol = db.collection('users');
        const { insertedId } = await usersCol.insertOne(newUser);
        return NextResponse.json({ user_id: insertedId.toString() }, { status: 201 });
    } catch (err) {
        console.error('[DB Error /api/users]', err.message);
        return NextResponse.json(
            { error: 'DB_ERROR', message: 'Error al crear el usuario. Intenta de nuevo.' },
            { status: 500 }
        );
    }
}

