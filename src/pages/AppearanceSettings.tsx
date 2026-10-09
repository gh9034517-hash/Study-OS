import { useEffect, useState } from 'react';
import { setData, useData } from '../lib/store';
import {
  ACCENT_PRESETS,
  DEFAULT_APPEARANCE,
  HEADING_FONTS,
  accentPalette,
  isHex,
  resolveTheme,
  type Appearance,
  type HeadingFont,
} from '../lib/appearance';
import { Segmented } from '../components/Segmented';
import { Icon } from '../components/Icon';
import { useFeedback } from '../components/Feedback';

export function AppearanceSettings() {
  const { appearance: a } = useData();
  const { toast } = useFeedback();
  const [hex, setHex] = useState(a.accent);
  useEffect(() => setHex(a.accent), [a.accent]);

  const update = (patch: Partial<Appearance>) => setData((d) => ({ ...d, appearance: { ...d.appearance, ...patch } }));
  const palette = accentPalette(a.accent, resolveTheme(a.theme));
  const isPreset = ACCENT_PRESETS.some((p) => p.hex === a.accent);

  return (
    <section className="panel appearance" aria-labelledby="appearance-title">
      <div className="appearance-head">
        <div>
          <h2 className="settings-title" id="appearance-title">
            Aparência
          </h2>
          <p className="muted-text">As mudanças são aplicadas na hora e salvas automaticamente neste navegador (também vão no backup).</p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setData((d) => ({ ...d, appearance: { ...DEFAULT_APPEARANCE } }));
            toast('Aparência restaurada para o padrão.');
          }}
        >
          <Icon name="refresh" size={14} /> Restaurar padrão
        </button>
      </div>

      <div className="appearance-grid">
        <div className="appearance-block">
          <p className="field-label" id="theme-label">
            Tema
          </p>
          <Segmented
            label="Tema"
            value={a.theme}
            onChange={(theme) => update({ theme })}
            className="theme-options"
            options={[
              { value: 'escuro', label: <ThemeSwatch mode="escuro" text="Escuro" /> },
              { value: 'claro', label: <ThemeSwatch mode="claro" text="Claro" /> },
              { value: 'sistema', label: <ThemeSwatch mode="sistema" text="Sistema" />, hint: 'Segue o tema do seu dispositivo' },
            ]}
          />
        </div>

        <div className="appearance-block">
          <p className="field-label">Cor de destaque</p>
          <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                role="radio"
                aria-checked={a.accent === p.hex}
                aria-label={p.name}
                title={p.name}
                className="swatch"
                style={{ background: p.hex }}
                onClick={() => update({ accent: p.hex })}
              >
                {a.accent === p.hex && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
          <div className="custom-color">
            <label className={`swatch custom${!isPreset ? ' active' : ''}`} style={{ background: a.accent }} title="Escolher qualquer cor">
              <input type="color" value={a.accent} onChange={(e) => update({ accent: e.target.value.toLowerCase() })} aria-label="Cor personalizada" />
              <Icon name="edit" size={14} />
            </label>
            <label className="field hex-field">
              <span className="sr-only">Código hexadecimal da cor</span>
              <input
                className="input"
                value={hex}
                maxLength={7}
                spellCheck={false}
                aria-invalid={!isHex(hex)}
                onChange={(e) => {
                  const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                  setHex(v);
                  if (isHex(v)) update({ accent: v.toLowerCase() });
                }}
              />
            </label>
            <span className="muted-text">
              Texto sobre a cor: <strong>{palette.onAccent === '#ffffff' ? 'branco' : 'escuro'}</strong> (ajustado para manter a leitura)
            </span>
          </div>
        </div>

        <div className="appearance-block">
          <p className="field-label">Fonte dos títulos</p>
          <Segmented
            label="Fonte dos títulos"
            value={a.headingFont}
            onChange={(headingFont) => update({ headingFont })}
            className="font-options"
            options={(Object.keys(HEADING_FONTS) as HeadingFont[]).map((k) => ({
              value: k,
              label: (
                <>
                  <span className="font-sample" style={{ fontFamily: HEADING_FONTS[k].family }}>
                    Aa
                  </span>
                  {HEADING_FONTS[k].label}
                </>
              ),
            }))}
          />
        </div>

        <div className="appearance-block">
          <p className="field-label">Tamanho do texto</p>
          <Segmented
            label="Tamanho do texto"
            value={a.fontScale}
            onChange={(fontScale) => update({ fontScale })}
            options={[
              { value: 'normal', label: <span style={{ fontSize: '0.85rem' }}>A Normal</span> },
              { value: 'grande', label: <span style={{ fontSize: '1rem' }}>A Grande</span> },
              { value: 'extra', label: <span style={{ fontSize: '1.15rem' }}>A Extra</span> },
            ]}
          />
        </div>

        <div className="appearance-block">
          <p className="field-label">Cantos</p>
          <Segmented
            label="Cantos"
            value={a.corners}
            onChange={(corners) => update({ corners })}
            options={[
              { value: 'arredondado', label: <CornerSample r={12} text="Arredondado" /> },
              { value: 'suave', label: <CornerSample r={6} text="Suave" /> },
              { value: 'reto', label: <CornerSample r={2} text="Reto" /> },
            ]}
          />
        </div>

        <div className="appearance-block">
          <p className="field-label">Animações</p>
          <Segmented
            label="Animações"
            value={a.motion}
            onChange={(motion) => update({ motion })}
            options={[
              { value: 'completas', label: 'Completas' },
              { value: 'reduzidas', label: 'Reduzidas', hint: 'Desliga faixas em movimento, órbitas e transições' },
            ]}
          />
          <p className="muted-text small">Se o seu sistema pede menos movimento, ele é respeitado mesmo em “Completas”.</p>
        </div>

        <div className="appearance-block">
          <p className="field-label">Fundo</p>
          <Segmented
            label="Fundo"
            value={a.background}
            onChange={(background) => update({ background })}
            options={[
              { value: 'grade', label: 'Grade e brilho' },
              { value: 'liso', label: 'Liso' },
            ]}
          />
        </div>

        <div className="appearance-block">
          <p className="field-label">Faixas decorativas</p>
          <label className="switch">
            <input type="checkbox" role="switch" checked={a.ribbons} onChange={(e) => update({ ribbons: e.target.checked })} />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span>{a.ribbons ? 'Mostrar faixas diagonais' : 'Faixas ocultas'}</span>
          </label>
        </div>
      </div>

      <div className="appearance-preview" aria-label="Prévia">
        <p className="field-label">Prévia</p>
        <div className="preview-row">
          <p className="preview-title">
            Foco <em>total.</em>
          </p>
          <button type="button" className="btn btn-primary btn-sm" tabIndex={-1}>
            Botão principal
          </button>
          <button type="button" className="btn btn-sm" tabIndex={-1}>
            Secundário
          </button>
          <span className="chip">Etiqueta</span>
          <div className="meter" style={{ width: 120 }} aria-hidden="true">
            <i style={{ width: '64%' }} />
          </div>
          <a href="#/ajustes" className="preview-link" tabIndex={-1} onClick={(e) => e.preventDefault()}>
            Link de exemplo
          </a>
        </div>
      </div>
    </section>
  );
}

function ThemeSwatch({ mode, text }: { mode: 'escuro' | 'claro' | 'sistema'; text: string }) {
  return (
    <>
      <span className={`theme-swatch ${mode}`} aria-hidden="true">
        <i />
        <b />
      </span>
      {text}
    </>
  );
}

function CornerSample({ r, text }: { r: number; text: string }) {
  return (
    <>
      <span className="corner-sample" style={{ borderRadius: r }} aria-hidden="true" />
      {text}
    </>
  );
}
