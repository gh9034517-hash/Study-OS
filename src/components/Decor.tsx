import type { ReactNode } from 'react';

export function Ribbon({ words, alt = false }: { words: string[]; alt?: boolean }) {
  // Conteúdo duplicado para a animação contínua; a segunda metade é oculta para leitores de tela.
  const items = [...words, ...words, ...words];
  return (
    <div className={`ribbon${alt ? ' alt' : ''}`} aria-hidden="true">
      <div className="ribbon-track">
        {[...items, ...items].map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
    </div>
  );
}

export function Wave({ bottom = false }: { bottom?: boolean }) {
  return (
    <svg className={`wave${bottom ? ' bottom' : ''}`} viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
      <path fill="currentColor" d="M0 100V62C180 18 360 0 560 22s380 74 600 64 220-42 280-56v70z" />
    </svg>
  );
}

export function PageHero({
  num,
  label,
  ghost,
  title,
  lead,
  children,
}: {
  num: string;
  label: string;
  ghost: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <span className="ghost-word" aria-hidden="true">
        {ghost}
      </span>
      <div className="eyebrow">
        <span className="num">{num}</span>
        {label}
      </div>
      <h1 className="page-title">{title}</h1>
      {lead && <p className="page-lead">{lead}</p>}
      {children}
    </header>
  );
}

/** Núcleo orbital animado — elemento-assinatura do StudyOS. */
export function Orb({ size = 280 }: { size?: number }) {
  return (
    <svg className="orb" width={size} height={size} viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <radialGradient id="orb-core" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#cfe0ff" />
          <stop offset="0.35" stopColor="#5d8dff" />
          <stop offset="1" stopColor="#0f1e52" />
        </radialGradient>
      </defs>
      <g className="orb-ring r1">
        <ellipse cx="150" cy="150" rx="136" ry="52" fill="none" stroke="rgba(156,195,255,.35)" strokeWidth="1.2" />
        <circle cx="286" cy="150" r="6" fill="#9cc3ff" />
      </g>
      <g className="orb-ring r2">
        <ellipse cx="150" cy="150" rx="118" ry="44" fill="none" stroke="rgba(47,107,255,.6)" strokeWidth="1.5" transform="rotate(60 150 150)" />
        <circle cx="209" cy="252" r="5" fill="#2f6bff" />
      </g>
      <g className="orb-ring r3">
        <ellipse cx="150" cy="150" rx="118" ry="44" fill="none" stroke="rgba(238,243,255,.25)" strokeWidth="1" transform="rotate(-60 150 150)" />
      </g>
      <circle cx="150" cy="150" r="66" fill="url(#orb-core)" />
      <circle cx="150" cy="150" r="66" fill="none" stroke="rgba(238,243,255,.4)" strokeWidth="1" />
      <path d="M128 136h44M128 150h44M128 164h28" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}
