import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

// Importação modular: só o que o app usa (mantém o bundle enxuto).
echarts.use([LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, MarkPointComponent, MarkLineComponent, CanvasRenderer]);

export type OpcaoGrafico = echarts.EChartsCoreOption;

export function EChart({ opcao, altura, rotulo }: { opcao: OpcaoGrafico; altura: number | string; rotulo: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const ch = echarts.init(el, null, { renderer: 'canvas' });
    inst.current = ch;
    const ro = new ResizeObserver(() => ch.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      ch.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.setOption(opcao, { notMerge: true, lazyUpdate: true });
  }, [opcao]);

  return <div ref={ref} style={{ height: altura }} className="w-full" role="img" aria-label={rotulo} />;
}
