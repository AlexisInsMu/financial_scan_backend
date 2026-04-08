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
            description: "Debe ser: comida, alimentos,transporte,hormiga,entretenimiento,salud,compras u otros" 
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

const analisisGeneralSchema = {
  type: SchemaType.OBJECT,
  properties: {
    resumen_ejecutivo: { type: SchemaType.STRING },
    diagnostico: {
      type: SchemaType.OBJECT,
      properties: {
        nivel_actual: { 
          type: SchemaType.STRING, 
          description: "Debe ser uno de: excelente, saludable, regular, en_riesgo, critico" 
        },
        fortalezas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        riesgos: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        patrones_detectados: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      }
    },
    insights_clave: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          titulo: { type: SchemaType.STRING },
          explicacion: { type: SchemaType.STRING },
          impacto_estimado_mxn_mes: { type: SchemaType.NUMBER }
        }
      }
    },
    metas_recomendadas: {
      type: SchemaType.OBJECT,
      properties: {
        meta_gasto_hormiga_pct: { type: SchemaType.NUMBER },
        meta_tickets_semanales: { type: SchemaType.NUMBER },
        ahorro_potencial_mxn_mes: { type: SchemaType.NUMBER }
      }
    },
    mensaje_motivacional: { type: SchemaType.STRING }
  },
  required: ["resumen_ejecutivo", "diagnostico", "insights_clave", "metas_recomendadas", "mensaje_motivacional"]
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


const PROMPT_ANALISIS_GENERAL = `
Eres un analista financiero personal para jóvenes en México.
Tu tarea es generar un análisis claro, accionable y empático usando el historial de tickets del usuario y su score de salud financiera.

REGLAS:
- Responde SIEMPRE en español.
- Usa tono cercano, sin regaños, enfocado en progreso.
- No inventes datos: si algo no está en la entrada, indícalo como "dato no disponible".
- Prioriza hallazgos prácticos sobre teoría.
- No uses lenguaje técnico complejo.

ENTRADA:
- Fecha actual: {{FECHA_HOY}}
- Usuario:
{{USER_PROFILE_JSON}}
- Tickets recientes (máximo 10):
{{TICKETS_RECIENTES_JSON}}

OBJETIVOS DEL ANÁLISIS:
1) Explicar el estado financiero actual del usuario en lenguaje simple.
2) Detectar patrones de gasto (comercios, categorías, frecuencia, gasto hormiga).
3) Señalar 2 a 4 oportunidades de mejora de mayor impacto.
4) Proponer un mini plan de 7 días y otro de 30 días.
5) Proyectar ahorro potencial mensual si reduce gastos hormiga.

CRITERIOS ESPECÍFICOS:
- Si el score es bajo, enfócate en pasos pequeños y alcanzables.
- Si hay mejora vs mes anterior, reconócelo explícitamente.
- Si no hay suficiente data, ofrece recomendaciones conservadoras y pide más registros.
- Evita repetir recomendaciones casi idénticas.
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

export async function generarAnalisisGeneral(inputData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const fechaHoy = new Date().toISOString().split('T')[0];

  let templateBase = PROMPT_ANALISIS_GENERAL;
  let prompt = templateBase.replace('{{USER_PROFILE_JSON}}', JSON.stringify(inputData.userProfile));
  prompt = prompt.replace('{{TICKETS_RECIENTES_JSON}}', JSON.stringify(inputData.ticketsRecientes));
  prompt = prompt.replace('{{FECHA_HOY}}', fechaHoy);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: analisisGeneralSchema, 
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

