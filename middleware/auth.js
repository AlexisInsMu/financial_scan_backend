// middleware/auth.js
import { NextResponse } from 'next/server';

export function verificarAuth(request) {
  // Simulación temporal: Siempre permite el paso.
  // TODO: Implementar lógica real de verificación de autenticación (e.g., JWT, sesiones, etc.)
  return { ok: true, user: "test-user" }; 
}