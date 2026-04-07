import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY no está definida en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const PROMPT_VER = 'v1.3';

const ticketSchema = {
  type: SchemaType.OBJECT,
  properties: {
    comercio: { 
      type: SchemaType.STRING, 
      description: "Nombre del comercio o 'Varios' si no se menciona." 
    },
    fecha: { 
      type: SchemaType.STRING, 
      description: "Fecha de la compra (YYYY-MM-DD)" 
    },
    total: { 
      type: SchemaType.NUMBER, 
      description: "Monto total gastado" 
    },
    productos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          precio: { type: SchemaType.NUMBER },
          categoria: { 
            type: SchemaType.STRING, 
            description: "Debe ser: alimentos, bebidas, snacks, transporte, entretenimiento, farmacia u otro" 
          },
          es_gasto_hormiga: { type: SchemaType.BOOLEAN }
        },
        required: ["nombre", "precio", "categoria", "es_gasto_hormiga"]
      }
    },
    gasto_hormiga_ticket: { type: SchemaType.NUMBER },
    ahorro_total_hormiga_mensual: { type: SchemaType.NUMBER },
    mensaje_educativo: { 
      type: SchemaType.STRING, 
      description: "Mensaje empático en segunda persona, máximo 2 oraciones." 
    }
  },
  required: ["comercio", "fecha", "total", "productos", "gasto_hormiga_ticket", "ahorro_total_hormiga_mensual", "mensaje_educativo"]
};

const PROMPT_TEMPLATE_OCR = `
Eres un asistente de educación financiera para jóvenes. Analiza el siguiente texto extraído de un ticket.
Reglas de negocio:
- Gasto hormiga: snacks, refrescos, café preparado, dulces, botanas, compras menores a $80 MXN.
- ahorro_total_hormiga_mensual = gasto_hormiga_ticket * 4.

TEXTO DEL TICKET:
{{INPUT_TEXT}}
`;

const PROMPT_TEMPLATE_VOICE = `
Eres un asistente de educación financiera para jóvenes. Analiza la siguiente transcripción de voz de un usuario reportando un gasto.
Reglas de negocio:
- Si dice un número en letras (ej. "cuarenta y cinco pesos"), conviértelo a número.
- Si no menciona fecha, usa obligatoriamente esta fecha: {{FECHA_HOY}}.
- Gasto hormiga: snacks, refrescos, café preparado, dulces, botanas, compras menores a $80 MXN.
- ahorro_total_hormiga_mensual = gasto_hormiga_ticket * 4.

TRANSCRIPCIÓN DE VOZ:
{{INPUT_TEXT}}
`;

export async function procesarTicketConGemini(inputText, tipoPeticion = 0) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const fechaHoy = new Date().toISOString().split('T')[0];

  let templateBase = tipoPeticion === 1 ? PROMPT_TEMPLATE_VOICE : PROMPT_TEMPLATE_OCR;
  let prompt = templateBase.replace('{{INPUT_TEXT}}', inputText);
  prompt = prompt.replace('{{FECHA_HOY}}', fechaHoy);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: ticketSchema, 
    },
  });

  const rawText = result.response.text();

  try {
    const parsed = JSON.parse(rawText);
    return parsed;
  } catch (error) {
    console.error("Texto que falló al parsear:", rawText);
    throw new Error('Error al parsear el JSON de Gemini: ' + error.message);
  }
}