import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { tamanho?: number };

function Base({ tamanho = 20, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  );
}

export const IconeFuturo = (p: P) => (
  <Base {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 6-7" />
  </Base>
);
export const IconePatrimonio = (p: P) => (
  <Base {...p}>
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v9h14v-9" />
    <path d="M9 19v-5h6v5" />
  </Base>
);
export const IconeFechamento = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M9 15l2 2 4-4" />
  </Base>
);
export const IconeLancamentos = (p: P) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </Base>
);
export const IconeOrcamento = (p: P) => (
  <Base {...p}>
    <path d="M21 12A9 9 0 1 1 12 3v9z" />
    <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
  </Base>
);
export const IconeConfig = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Base>
);
export const IconeMais = (p: P) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconeMenu = (p: P) => (
  <Base {...p}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Base>
);
export const IconeLapis = (p: P) => (
  <Base {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Base>
);
export const IconeLixeira = (p: P) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </Base>
);
export const IconeFechar = (p: P) => (
  <Base {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Base>
);
export const IconeAlerta = (p: P) => (
  <Base {...p}>
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);
export const IconeCheck = (p: P) => (
  <Base {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Base>
);
export const IconeRelogio = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);
export const IconeInfo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Base>
);
export const IconeDownload = (p: P) => (
  <Base {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Base>
);
export const IconeUpload = (p: P) => (
  <Base {...p}>
    <path d="M12 21V9M7 14l5-5 5 5M4 3h16" />
  </Base>
);
export const IconeSeta = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const IconeVoltar = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
);
export const IconeAjustes = (p: P) => (
  <Base {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Base>
);
export const IconeTabela = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M10 4v16" />
  </Base>
);
