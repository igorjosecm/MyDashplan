const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const fmtBRL = (reais: number): string => brl.format(reais === 0 ? 0 : reais);
export const fmtCentavos = (c: number): string => fmtBRL(c / 100);
export const fmtCentavos0 = (c: number): string => brl0.format(Math.round(c / 100));
export const fmtNum = (x: number): string => num.format(x);
export const fmtPct = (x: number, casas = 1): string =>
  `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/** Formato compacto para eixos: R$ 1,2 mi · R$ 350 mil. */
export function fmtCompacto(reais: number): string {
  const a = Math.abs(reais);
  const s = reais < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `${s}R$ ${a.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 'Mmm/AAAA' */
export const fmtMesCurto = (y: number, m: number): string => `${MESES_CURTOS[m - 1]}/${y}`;
/** 'AAAA-MM' → 'outubro de 2026' */
export function fmtMesLongo(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES_LONGOS[m - 1]} de ${y}`;
}
/** 'AAAA-MM' → 'Out/2026' */
export function fmtMesIso(mes: string | null): string {
  if (!mes) return '—';
  const [y, m] = mes.split('-').map(Number);
  return fmtMesCurto(y, m);
}
/** 'AAAA-MM-DD' → 'dd/mm/aaaa' (ou 'dd/mm' se curto). */
export function fmtData(d: string | null, curto = false): string {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return curto ? `${dd}/${m}` : `${dd}/${m}/${y}`;
}

export const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;
