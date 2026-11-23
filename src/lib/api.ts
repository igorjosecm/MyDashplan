export class ErroApi extends Error {
  status: number;
  detalhes?: { campo: string; mensagem: string }[];
  constructor(status: number, msg: string, detalhes?: { campo: string; mensagem: string }[]) {
    super(msg);
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function req<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!r.ok) {
    const d = dados as { erro?: string; detalhes?: { campo: string; mensagem: string }[] } | null;
    const det = d?.detalhes?.map((x) => `${x.campo}: ${x.mensagem}`).join('; ');
    throw new ErroApi(r.status, (d?.erro ?? `Erro ${r.status}`) + (det ? ` (${det})` : ''), d?.detalhes);
  }
  return dados as T;
}

export const api = {
  get: <T>(c: string) => req<T>('GET', c),
  post: <T>(c: string, b?: unknown) => req<T>('POST', c, b ?? {}),
  put: <T>(c: string, b: unknown) => req<T>('PUT', c, b),
  del: <T>(c: string) => req<T>('DELETE', c),
};

export const mensagemErro = (e: unknown): string => (e instanceof Error ? e.message : String(e));
