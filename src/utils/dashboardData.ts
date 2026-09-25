const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function monthSortKey(value: unknown): number | null {
  const match = normalizeText(value).match(/^(.+?)\s+(19\d{2}|20\d{2})$/);
  if (!match) return null;
  const month = MONTH_NAMES.indexOf(match[1]);
  if (month === -1) return null;
  return Number(match[2]) * 12 + month;
}

function sortMonthlySeries<T extends { month?: string; count?: number }>(series: T[] | undefined): T[] {
  return (Array.isArray(series) ? series : []).slice().sort((a, b) => {
    const keyA = monthSortKey(a.month);
    const keyB = monthSortKey(b.month);
    if (keyA === null && keyB === null) return 0;
    if (keyA === null) return 1;
    if (keyB === null) return -1;
    return keyA - keyB;
  });
}

function currentMonthLabel(now: Date): string {
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(now);
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${now.getFullYear()}`;
}

function normalizeBranch<T extends Record<string, any>>(branch: T, now: Date): T {
  const mensalData = sortMonthlySeries(branch.mensalData);
  const equipamentosMensal = sortMonthlySeries(branch.equipamentosMensal);
  const target = normalizeText(currentMonthLabel(now));
  const currentMonthKey = Object.keys(branch.porMes || {}).find((key) => normalizeText(key) === target);
  const currentMonthData = currentMonthKey ? branch.porMes[currentMonthKey] : undefined;
  const currentMonthSeries = mensalData.find((item) => normalizeText(item.month) === target);
  const currentCount = currentMonthData
    ? Number(currentMonthData.desligamentosMesAtual ?? currentMonthData.totalDesligamentos) || 0
    : Number(currentMonthSeries?.count) || 0;

  return {
    ...branch,
    mensalData,
    equipamentosMensal,
    desligamentosMesAtual: currentCount,
  };
}

export function normalizeDashboardSummary<T extends Record<string, any>>(summary: T, now = new Date()): T {
  const normalized = normalizeBranch(summary, now);
  if (!summary.filiais || typeof summary.filiais !== 'object') return normalized;

  const filiais = Object.fromEntries(
    Object.entries(summary.filiais).map(([key, branch]) => [
      key,
      branch && typeof branch === 'object' ? normalizeBranch(branch, now) : branch,
    ]),
  );
  const all = filiais.Todas as Record<string, any> | undefined;

  return {
    ...normalized,
    filiais,
    ...(all ? {
      totalDesligamentos: all.totalDesligamentos,
      desligamentosMesAtual: all.desligamentosMesAtual,
      mensalData: all.mensalData,
      equipamentosMensal: all.equipamentosMensal,
      equipamentosRanking: all.equipamentosRanking,
      pendencias: all.pendencias,
      recentReturns: all.recentReturns,
    } : {}),
  };
}
