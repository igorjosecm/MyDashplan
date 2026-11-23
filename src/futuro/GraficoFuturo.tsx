import { useMemo, useState } from 'react';
import { idadeNoMes, parseDataCivil, type MotorResultado } from '../../shared/finance-engine.ts';
import type { FuturoResposta } from '../../shared/types.ts';
import { EChart, type OpcaoGrafico } from '../components/EChart.tsx';
import { IconeTabela } from '../components/icones.tsx';
import { Alternador, Segmentado } from '../components/ui.tsx';
import { fmtBRL, fmtCompacto, fmtMesCurto } from '../lib/format.ts';
import { TIPOS } from './tiposProjeto.ts';

// Paleta validada (scripts/validate_palette.js da skill de dataviz): ordem fixa das séries.
const COR = { total: '#2a78d6', principal: '#eb6834', ideal: '#1baf7a', real: '#eda100' };
const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', muda: '#6f6e69', grade: '#e1e0d9', eixo: '#c3c2b7' };

type Zoom = 24 | 60 | 120 | 0;
const ZOOMS: { valor: Zoom; rotulo: string }[] = [
  { valor: 24, rotulo: '2 anos' },
  { valor: 60, rotulo: '5 anos' },
  { valor: 120, rotulo: '10 anos' },
  { valor: 0, rotulo: 'Máximo' },
];

const kDe = (y: number, m: number) => y * 12 + (m - 1);
const ymDe = (k: number) => ({ y: Math.floor(k / 12), m: (k % 12) + 1 });

function tetoBonito(v: number): number {
  if (v <= 0) return 0;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  for (const f of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (f * e >= v) return f * e;
  return 10 * e;
}

function ItemLegenda({ cor, texto, linha, losango }: { cor: string; texto: string; linha?: boolean; losango?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={linha ? 'h-0.5 w-4 rounded' : losango ? 'h-2.5 w-2.5 rotate-45 rounded-[1px]' : 'h-2.5 w-3.5 rounded-sm'}
        style={{ background: cor }}
      />
      {texto}
    </li>
  );
}

export function GraficoFuturo({
  r,
  nascimento,
  fechamentos,
  modoIF,
}: {
  r: MotorResultado;
  nascimento: string;
  fechamentos: FuturoResposta['fechamentos'];
  modoIF: 'cp' | 'vr';
}) {
  const [zoom, setZoom] = useState<Zoom>(0);
  const [negativos, setNegativos] = useState(false);
  const [mostrarReal, setMostrarReal] = useState(true);
  const [tabela, setTabela] = useState(false);
  const nasc = useMemo(() => parseDataCivil(nascimento), [nascimento]);

  const opcao = useMemo<OpcaoGrafico>(() => {
    const s = r.serie;
    if (!s.length) return {};
    const k0 = kDe(s[0].y, s[0].m);
    const kN = kDe(s[s.length - 1].y, s[s.length - 1].m);
    const reais = mostrarReal
      ? fechamentos.map((f) => {
          const [y, m] = f.mes.split('-').map(Number);
          return [kDe(y, m), f.pl_centavos / 100] as [number, number];
        })
      : [];
    const inicio = Math.min(k0, ...reais.map((p) => p[0]));
    const fim = zoom ? Math.min(kN, k0 + zoom - 1) : kN;

    // Faixa do eixo Y dentro da janela (§4.7: piso 0, ou o menor valor se "mostrar negativos").
    let max = 0;
    let min = 0;
    for (const l of s) {
      const k = kDe(l.y, l.m);
      if (k < inicio || k > fim) continue;
      max = Math.max(max, l.saldo, l.principal, l.consumo);
      min = Math.min(min, l.saldo, l.principal, l.consumo);
    }
    for (const [, v] of reais) max = Math.max(max, v);
    const yMax = tetoBonito(max * 1.08) || 1;
    const yMin = negativos && min < 0 ? -tetoBonito(-min * 1.05) : 0;

    // Marcadores: aposentadoria, independência e início de cada projeto, empilhados por mês.
    const ifm = modoIF === 'cp' ? r.marcos.independenciaCP : r.marcos.independenciaVR;
    const marcos: { k: number; icone: string; nome: string; cor: string }[] = [];
    if (r.marcos.mesAposentadoria) {
      const a = r.marcos.mesAposentadoria;
      marcos.push({ k: kDe(a.y, a.m), icone: '🏖️', nome: `Aposentadoria aos ${a.idade} anos`, cor: TINTA.secundaria });
    }
    if (ifm) marcos.push({ k: kDe(ifm.y, ifm.m), icone: '⭐', nome: `Independência financeira aos ${ifm.idade} anos`, cor: '#1c5cab' });
    for (const p of r.marcos.projetos) {
      marcos.push({ k: kDe(p.y, p.m), icone: TIPOS[p.tipo].icone, nome: p.nome ?? TIPOS[p.tipo].rotulo, cor: TINTA.muda });
    }
    const porMes = new Map<number, number>();
    const saldoEm = new Map(s.map((l) => [kDe(l.y, l.m), l.saldo]));
    const pontosMarco = marcos
      .filter((m) => m.k >= inicio && m.k <= fim)
      .map((m) => {
        const n = porMes.get(m.k) ?? 0;
        porMes.set(m.k, n + 1);
        const y = Math.max(yMin, Math.min(yMax, saldoEm.get(m.k) ?? 0));
        return {
          name: m.nome,
          coord: [m.k, y],
          value: m.icone,
          symbol: 'pin',
          symbolSize: 34,
          symbolOffset: [0, -n * 30 - 2],
          itemStyle: { color: m.cor, borderColor: '#fff', borderWidth: 1.5 },
          label: { show: true, formatter: m.icone, fontSize: 13, offset: [0, -3] },
        };
      });

    const idadeEm = (k: number) => {
      const { y, m } = ymDe(k);
      return idadeNoMes(nasc, y, m);
    };
    const area = (cor: string) => ({
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: cor + '66' },
          { offset: 1, color: cor + '0a' },
        ],
      },
    });

    return {
      animation: false,
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: TINTA.secundaria },
      // Legenda em HTML abaixo do gráfico (quebra linha bem no celular).
      grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: TINTA.eixo } },
        backgroundColor: '#fff',
        borderColor: TINTA.grade,
        textStyle: { color: TINTA.primaria, fontSize: 12 },
        formatter: (ps: { axisValue: number; marker: string; seriesName: string; value: [number, number] }[]) => {
          if (!ps.length) return '';
          const k = Math.round(ps[0].axisValue ?? ps[0].value[0]);
          const { y, m } = ymDe(k);
          const titulo = `<div style="font-weight:600;margin-bottom:4px">${fmtMesCurto(y, m)}: ${idadeEm(k)} anos</div>`;
          const linhas = ps
            .map(
              (p) =>
                `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.marker}${p.seriesName}</span><b style="font-variant-numeric:tabular-nums">${fmtBRL(p.value[1])}</b></div>`,
            )
            .join('');
          return titulo + linhas;
        },
      },
      xAxis: {
        type: 'value',
        min: inicio,
        max: fim,
        minInterval: 12,
        splitNumber: 8,
        axisLine: { lineStyle: { color: TINTA.eixo } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: TINTA.muda, fontSize: 11, formatter: (v: number) => `${idadeEm(Math.round(v))}a`, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        splitNumber: 4,
        axisLabel: { color: TINTA.muda, fontSize: 11, formatter: (v: number) => fmtCompacto(v) },
        splitLine: { lineStyle: { color: TINTA.grade } },
      },
      series: [
        {
          name: 'Patrimônio total projetado',
          type: 'line',
          showSymbol: false,
          data: s.map((l) => [kDe(l.y, l.m), l.saldo]),
          lineStyle: { width: 2, color: COR.total },
          itemStyle: { color: COR.total },
          areaStyle: area(COR.total),
          markPoint: { data: pontosMarco, tooltip: { trigger: 'item', formatter: (p: { name: string }) => p.name } },
          z: 3,
        },
        {
          name: 'Patrimônio principal investido',
          type: 'line',
          showSymbol: false,
          data: s.map((l) => [kDe(l.y, l.m), l.principal]),
          lineStyle: { width: 2, color: COR.principal },
          itemStyle: { color: COR.principal },
          areaStyle: area(COR.principal),
          z: 2,
        },
        {
          name: 'Aposentadoria ideal',
          type: 'line',
          showSymbol: false,
          data: s.map((l) => [kDe(l.y, l.m), l.consumo]),
          lineStyle: { width: 2, color: COR.ideal },
          itemStyle: { color: COR.ideal },
          z: 4,
        },
        ...(reais.length
          ? [
              {
                name: 'PL real (fechamentos)',
                type: 'scatter',
                data: reais,
                symbol: 'diamond',
                symbolSize: 11,
                itemStyle: { color: COR.real, borderColor: '#fff', borderWidth: 2 },
                z: 5,
              },
            ]
          : []),
      ],
    };
  }, [r, zoom, negativos, mostrarReal, fechamentos, nasc, modoIF]);

  const linhasTabela = useMemo(() => r.serie.filter((l, i) => l.m === 12 || i === r.serie.length - 1), [r]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Segmentado rotulo="Período do gráfico" opcoes={ZOOMS} valor={zoom} aoMudar={setZoom} />
        <button
          type="button"
          onClick={() => setTabela(!tabela)}
          aria-pressed={tabela}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-sunken"
        >
          <IconeTabela tamanho={16} /> {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {tabela ? (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-line">
          <table className="tnum w-full text-right text-[13px]">
            <caption className="sr-only">Projeção anual do patrimônio</caption>
            <thead className="sticky top-0 bg-sunken text-[12px] text-ink-2">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mês</th>
                <th className="px-3 py-2 font-medium">Idade</th>
                <th className="px-3 py-2 font-medium">Total projetado</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Aposentadoria ideal</th>
              </tr>
            </thead>
            <tbody>
              {linhasTabela.map((l) => (
                <tr key={l.t} className="border-t border-line">
                  <td className="px-3 py-1.5 text-left">{fmtMesCurto(l.y, l.m)}</td>
                  <td className="px-3 py-1.5">{l.idade}</td>
                  <td className={`px-3 py-1.5 ${l.saldo < 0 ? 'text-critical' : ''}`}>{fmtBRL(l.saldo)}</td>
                  <td className="px-3 py-1.5">{fmtBRL(l.principal)}</td>
                  <td className="px-3 py-1.5">{fmtBRL(l.consumo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <EChart opcao={opcao} altura={320} rotulo="Gráfico da projeção do patrimônio até o fim do horizonte de vida" />
          <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-label="Legenda">
            <ItemLegenda cor={COR.total} texto="Patrimônio total projetado" />
            <ItemLegenda cor={COR.principal} texto="Patrimônio principal investido" />
            <ItemLegenda cor={COR.ideal} texto="Aposentadoria ideal" linha />
            {mostrarReal && fechamentos.length > 0 && <ItemLegenda cor={COR.real} texto="PL real (fechamentos)" losango />}
            <li className="flex items-center gap-1.5">🏖️ aposentadoria · ⭐ independência</li>
          </ul>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <Alternador rotulo="Mostrar valores negativos" ativo={negativos} aoMudar={setNegativos} />
        {fechamentos.length > 0 && <Alternador rotulo="Planejado × realizado (PL dos fechamentos)" ativo={mostrarReal} aoMudar={setMostrarReal} />}
      </div>
    </div>
  );
}
