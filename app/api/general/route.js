import { NextResponse } from "next/server";
import { generarAnalisisGeneral } from "@/lib/gemini";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { validarUserId } from "@/lib/validators";


export async function GET(request) {
    if (!request.url) {
        return NextResponse.json(
            { error: 'INVALID_REQUEST', message: 'La solicitud no contiene una URL válida.' },
            { status: 400 }
        );
    }


    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
        return NextResponse.json(
            { error: 'MISSING_USER_ID', message: 'El parámetro user_id es requerido.' },
            { status: 400 }
        );
    }

    if (!ObjectId.isValid(user_id)) {
        return NextResponse.json(
            { error: 'INVALID_USER_ID', message: 'El user_id proporcionado no es un ObjectId válido.' },
            { status: 400 }
        );
    }

    const userCheck = validarUserId(user_id);
    if (!userCheck.ok) {
        return NextResponse.json(userCheck, { status: 400 });
    }

    try {
        const db = await getDb();
        const ticketsCol = db.collection('tickets');
        const usersCol   = db.collection('users');

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
        analisis_general : analisis_general,
        });
    }
    catch (err) {
    console.error('[DB Error /api/dashboard]', err.message);
    return NextResponse.json(
      { error: 'DB_ERROR', message: 'Error al obtener el dashboard.' },
      { status: 500 }
    );
  }
    
}