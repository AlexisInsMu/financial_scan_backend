/**
 * Validadores reutilizables — Financial Scan
 */

// Valida que el texto OCR tenga contenido mínimo viable
export function validarOcrText(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, error: 'OCR_TEXT_EMPTY', message: 'El texto del ticket está vacío.' };
  }
  if (text.trim().length < 20) {
    return { ok: false, error: 'OCR_TEXT_SHORT', message: 'El texto del ticket es demasiado corto.' };
  }
  if (!/\d+[\.,]\d{2}/.test(text)) {
    return {
      ok: false,
      error: 'OCR_NO_AMOUNTS',
      message: 'No se encontraron montos en el ticket. Asegúrate de capturar el ticket completo.',
    };
  }
  return { ok: true };
}

// Valida la estructura del JSON generado (por Gemini o por Phi-3.5 local)
export function validarTicketJson(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'INVALID_JSON', message: 'El JSON del ticket no es válido.' };
  }
  if (typeof data.comercio !== 'string' || data.comercio.trim() === '') {
    return { ok: false, error: 'MISSING_COMERCIO', message: 'Falta el nombre del comercio.' };
  }
  if (typeof data.total !== 'number' || data.total <= 0) {
    return { ok: false, error: 'INVALID_TOTAL', message: 'El total del ticket no es válido.' };
  }
  if (!Array.isArray(data.productos) || data.productos.length === 0) {
    return { ok: false, error: 'MISSING_PRODUCTOS', message: 'No se encontraron productos en el ticket.' };
  }
  return { ok: true };
}

// Valida que el user_id tenga formato de ObjectId
export function validarUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return { ok: false, error: 'MISSING_USER_ID', message: 'user_id es requerido.' };
  }
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    return { ok: false, error: 'INVALID_USER_ID', message: 'user_id tiene formato inválido.' };
  }
  return { ok: true };
}