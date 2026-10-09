// Personalização visual: tema, cor de destaque, tipografia, cantos, animações e efeitos.
// A cor escolhida gera automaticamente variações com contraste mínimo garantido (WCAG).

export type ThemeMode = 'escuro' | 'claro' | 'sistema';
export type FontScale = 'normal' | 'grande' | 'extra';
export type HeadingFont = 'futurista' | 'geometrica' | 'tecnica' | 'classica';
export type Corners = 'arredondado' | 'suave' | 'reto';

export interface Appearance {
  theme: ThemeMode;
  accent: string; // #rrggbb
  fontScale: FontScale;
  headingFont: HeadingFont;
  corners: Corners;
  motion: 'completas' | 'reduzidas';
  background: 'grade' | 'liso';
  ribbons: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'escuro',
  accent: '#2f6bff',
  fontScale: 'normal',
  headingFont: 'futurista',
  corners: 'arredondado',
  motion: 'completas',
  background: 'grade',
  ribbons: true,
};

export const ACCENT_PRESETS = [
  { name: 'Azul elétrico', hex: '#2f6bff' },
  { name: 'Ciano', hex: '#00a3c4' },
  { name: 'Violeta', hex: '#7c4dff' },
  { name: 'Esmeralda', hex: '#10a36e' },
  { name: 'Âmbar', hex: '#f5a524' },
  { name: 'Coral', hex: '#ff5a5f' },
  { name: 'Magenta', hex: '#d63cf0' },
  { name: 'Grafite', hex: '#64748b' },
];

export const HEADING_FONTS: Record<HeadingFont, { label: string; family: string; url?: string }> = {
  futurista: { label: 'Futurista', family: "'Unbounded', 'Segoe UI', system-ui, sans-serif" },
  geometrica: {
    label: 'Geométrica',
    family: "'Sora', 'Segoe UI', system-ui, sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap',
  },
  tecnica: {
    label: 'Técnica',
    family: "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
    url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap',
  },
  classica: {
    label: 'Clássica',
    family: "'Fraunces', Georgia, serif",
    url: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap',
  },
};

const FONT_SCALE: Record<FontScale, string> = { normal: '100%', grande: '112.5%', extra: '125%' };
const CORNERS: Record<Corners, [number, number, number, string]> = {
  arredondado: [10, 16, 26, '999px'],
  suave: [8, 12, 16, '14px'],
  reto: [3, 4, 6, '6px'],
};

// Superfícies de referência para o cálculo de contraste.
const SURFACES = {
  escuro: { bg: '#040920', panel: '#0a1640' },
  claro: { bg: '#e9eefa', panel: '#ffffff' },
};
const INK = '#081233';

// ── Utilitários de cor ───────────────────────────────────────────────────
type RGB = [number, number, number];

export function isHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

function toRgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mistura a cor em direção a `toward` até atingir o contraste mínimo contra todos os fundos. */
function ensureContrast(color: string, backgrounds: string[], min: number, toward: string): string {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const c = mix(color, toward, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

export function resolveTheme(mode: ThemeMode): 'escuro' | 'claro' {
  if (mode !== 'sistema') return mode;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro';
}

export interface AccentPalette {
  electric: string;
  strong: string;
  soft: string;
  sky: string;
  text: string;
  onLight: string;
  onAccent: string;
  rgb: string;
}

export function accentPalette(hex: string, theme: 'escuro' | 'claro'): AccentPalette {
  const base = isHex(hex) ? hex.toLowerCase() : DEFAULT_APPEARANCE.accent;
  const s = SURFACES[theme];
  const onAccent = contrast('#ffffff', base) >= contrast(INK, base) ? '#ffffff' : INK;
  const dark = theme === 'escuro';
  return {
    electric: base,
    strong: mix(base, '#000000', 0.16),
    soft: dark ? mix(base, '#ffffff', 0.28) : base,
    // Texto pequeno colorido (rótulos, links): 4.5:1 contra o fundo e os painéis.
    sky: dark ? ensureContrast(mix(base, '#ffffff', 0.5), [s.bg, s.panel], 4.5, '#ffffff') : ensureContrast(base, [s.bg, s.panel], 4.5, INK),
    // Destaques em títulos grandes: 3:1 contra o fundo.
    text: dark ? ensureContrast(mix(base, '#ffffff', 0.25), [s.bg], 3, '#ffffff') : ensureContrast(base, [s.bg, '#ffffff'], 3, INK),
    // Marcas de gráfico e destaques sobre superfícies brancas: 3:1.
    onLight: ensureContrast(base, ['#ffffff', '#eef3ff'], 3, INK),
    onAccent,
    rgb: toRgb(base).join(' '),
  };
}

let systemListener: ((e: MediaQueryListEvent) => void) | null = null;
let current: Appearance = DEFAULT_APPEARANCE;

export function applyAppearance(input: Appearance | undefined) {
  const a = { ...DEFAULT_APPEARANCE, ...(input ?? {}) };
  current = a;
  const root = document.documentElement;
  const theme = resolveTheme(a.theme);
  const p = accentPalette(a.accent, theme);

  root.dataset.theme = theme;
  root.dataset.motion = a.motion;
  root.dataset.bg = a.background;
  root.dataset.ribbons = a.ribbons ? 'on' : 'off';

  const vars: Record<string, string> = {
    '--electric': p.electric,
    '--electric-strong': p.strong,
    '--electric-soft': p.soft,
    '--sky': p.sky,
    '--accent-text': p.text,
    '--accent-on-light': p.onLight,
    '--on-accent': p.onAccent,
    '--accent-rgb': p.rgb,
    '--font-display': HEADING_FONTS[a.headingFont].family,
  };
  const [sm, md, lg, pill] = CORNERS[a.corners];
  vars['--r-sm'] = `${sm}px`;
  vars['--r-md'] = `${md}px`;
  vars['--r-lg'] = `${lg}px`;
  vars['--r-pill'] = pill;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.fontSize = FONT_SCALE[a.fontScale];
  root.style.background = ''; // remove o fundo provisório definido no index.html

  const font = HEADING_FONTS[a.headingFont];
  if (font.url && !document.querySelector(`link[data-font="${a.headingFont}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.url;
    link.dataset.font = a.headingFont;
    document.head.appendChild(link);
  }

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'claro' ? '#e9eefa' : '#040920');

  // Acompanha a troca de tema do sistema operacional quando "sistema" está selecionado.
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: light)') : null;
  if (systemListener && mq) mq.removeEventListener('change', systemListener);
  systemListener = null;
  if (a.theme === 'sistema' && mq) {
    systemListener = () => applyAppearance(current);
    mq.addEventListener('change', systemListener);
  }
}

export function normalizeAppearance(raw: unknown): Appearance {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
  const d = DEFAULT_APPEARANCE;
  return {
    theme: pick(r.theme, ['escuro', 'claro', 'sistema'], d.theme),
    accent: typeof r.accent === 'string' && isHex(r.accent) ? r.accent.toLowerCase() : d.accent,
    fontScale: pick(r.fontScale, ['normal', 'grande', 'extra'], d.fontScale),
    headingFont: pick(r.headingFont, ['futurista', 'geometrica', 'tecnica', 'classica'], d.headingFont),
    corners: pick(r.corners, ['arredondado', 'suave', 'reto'], d.corners),
    motion: pick(r.motion, ['completas', 'reduzidas'], d.motion),
    background: pick(r.background, ['grade', 'liso'], d.background),
    ribbons: typeof r.ribbons === 'boolean' ? r.ribbons : d.ribbons,
  };
}
