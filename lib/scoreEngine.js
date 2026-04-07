/**
 * Score de Salud IA — Financial Scan
 * Lógica: mixta (base acumulativa + score mensual)
 * Pesos: Frecuencia 35% · Hormiga 25% · Tendencia 25% · Diversidad 15%
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calcularScoreSalud(usuario, ticketsMes) {
  const ticketsTotalesVida = usuario.tickets_totales_vida ?? 0;

  // — Datos del mes actual —
  const gastoTotal = ticketsMes.reduce((s, t) => s + (t.raw?.total ?? 0), 0);
  const gastoHormiga = ticketsMes.reduce(
    (s, t) => s + (t.analisis?.gasto_hormiga_ticket ?? 0), 0
  );
  const pctHormigaMes = gastoTotal > 0 ? gastoHormiga / gastoTotal : 0;
  const categoriasUnicas = new Set(
    ticketsMes.flatMap(t => (t.productos ?? []).map(p => p.categoria))
  );

  // Mes anterior (guardado en stats_mensuales del usuario)
  const pctHormigaAnt =
    usuario.stats_mensuales?.pct_hormiga_mes_anterior ?? pctHormigaMes;

  // — Capa 1: Base acumulativa (0–30) —
  const baseAcumulativa = Math.min(
    30,
    Math.log10(ticketsTotalesVida + 1) * 18
  );

  // — Capa 2: Score mensual (0–70) —

  // Factor A — Frecuencia de escaneo (35 pts)
  // Target: 8 tickets/mes (2 por semana)
  const pA = clamp(ticketsMes.length / 8, 0, 1) * 35;

  // Factor B — Control de gasto hormiga (25 pts)
  // 0% hormiga → 25pts | 40%+ hormiga → 0pts
  const pB = Math.max(0, 1 - pctHormigaMes / 0.40) * 25;

  // Factor C — Tendencia mensual (25 pts)
  // Mejorar ≥20pp → 25pts | Sin cambio → ~12.5pts | Empeorar ≥20pp → 0pts
  const delta = pctHormigaAnt - pctHormigaMes;
  const tendenciaNorm = clamp((delta + 0.20) / 0.40, 0, 1);
  const pC = tendenciaNorm * 25;

  // Factor D — Diversidad de categorías (15 pts)
  // 4+ categorías distintas → 15pts
  const pD = Math.min(1, categoriasUnicas.size / 4) * 15;

  const scoreTotal = Math.round(baseAcumulativa + pA + pB + pC + pD);

  return {
    valor: scoreTotal,
    nivel: getNivel(scoreTotal),
    factores: {
      base_acumulativa:      Math.round(baseAcumulativa),
      frecuencia:            Math.round(pA),
      control_hormiga:       Math.round(pB),
      tendencia:             Math.round(pC),
      diversidad_categorias: Math.round(pD),
    },
    // Se persiste para calcular tendencia el próximo mes
    pct_hormiga_mes: pctHormigaMes,
  };
}

function getNivel(score) {
  if (score >= 80) return 'excelente';
  if (score >= 60) return 'saludable';
  if (score >= 40) return 'regular';
  if (score >= 20) return 'en_riesgo';
  return 'critico';
}

// Calcula el impacto de un ticket individual (0–10)
export function calcularScoreImpacto(ticketData) {
  const pct =
    ticketData.total > 0
      ? ticketData.gasto_hormiga_ticket / ticketData.total
      : 0;
  return Math.round(Math.min(10, pct * 10 * 2));
}