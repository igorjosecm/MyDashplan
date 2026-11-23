import { Cabecalho, Card } from '../components/ui.tsx';

const TEXTOS: Record<string, { resumo: string; itens: string[] }> = {
  Lançamentos: {
    resumo: 'Controle de gastos com entrada manual rápida — sem Open Finance.',
    itens: [
      'Lançamento rápido em até 3 toques (valor → categoria), favoritos e texto livre ("uber 23,90 nubank ontem").',
      'Recorrências que geram previstos para confirmar com um gesto.',
      'Cartão com competência de fatura, parcelamentos e transferências entre contas.',
      'Importação de OFX/CSV com deduplicação e conciliação.',
    ],
  },
  Orçamento: {
    resumo: 'Metas mensais por categoria e cálculo automático da reserva de emergência.',
    itens: [
      'Orçado × realizado por classificação (renda, despesas obrigatórias, não obrigatórias…).',
      'Reserva de emergência = 6 × despesas obrigatórias (R-O2), alimentando o Meu Futuro.',
      'Regras de categorização que aprendem com as suas correções.',
    ],
  },
};

export function Placeholder({ titulo }: { titulo: 'Lançamentos' | 'Orçamento' }) {
  const t = TEXTOS[titulo];
  return (
    <div className="space-y-4">
      <Cabecalho titulo={titulo} subtitulo={t.resumo} />
      <Card>
        <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-700">Chega na Etapa 3</span>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] text-ink-2">
          {t.itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-ink-3">O banco de dados já tem as tabelas desta etapa (transações, recorrências, parcelamentos, regras, orçamentos).</p>
      </Card>
    </div>
  );
}
