import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PROMPT_VERSION = 'v1.0';

const PROMPT_TEMPLATE = `
Eres un asistente de educación financiera para jóvenes mexicanos.
Analiza el siguiente texto extraído de un ticket de compra y devuelve
ÚNICAMENTE un JSON válido con esta estructura exacta, sin texto adicional,
sin backticks, sin explicaciones:

{
  "comercio": "",
  "fecha": "",
  "total": 0,
  "productos": [
    { "nombre": "", "precio": 0, "categoria": "", "es_gasto_hormiga": false }
  ],
  "gasto_hormiga_ticket": 0,
  "ahorro_total_hormiga_mensual": 0,
  "mensaje_educativo": ""
}

Reglas:
- Categorías válidas: alimentos, bebidas, snacks, transporte, entretenimiento, farmacia, otro
- Gasto hormiga: snacks, refrescos, café preparado, dulces, botanas, compras < $80 MXN
- ahorro_total_hormiga_mensual = gasto_hormiga_ticket * 4
- mensaje_educativo: empático, segunda persona, máximo 2 oraciones, sin tecnicismos

TEXTO DEL TICKET:
{{OCR_TEXT}}
`;

export const PROMPT_VER = PROMPT_VERSION;

export async function procesarTicketConGemini(ocrText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = PROMPT_TEMPLATE.replace('{{OCR_TEXT}}', ocrText);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1000,
    },
  });

  const rawText = result.response.text().trim();

  // Limpiar backticks por si Gemini los incluye pese al prompt
  const cleanText = rawText.replace(/```json|```/g, '').trim();

  const parsed = JSON.parse(cleanText);

  // Validar campos mínimos
  if (
    typeof parsed.comercio !== 'string' ||
    typeof parsed.total !== 'number' ||
    !Array.isArray(parsed.productos)
  ) {
    throw new Error('Estructura JSON de Gemini incompleta o inválida.');
  }

  return parsed;
}