import { useState } from 'react';
import { Modal } from '../components/Modal';
import { setData } from '../lib/store';
import { uid } from '../lib/id';
import type { Level } from '../lib/types';

const SUGGESTIONS = ['Matemática', 'Português', 'Biologia', 'Física', 'Química', 'História', 'Geografia', 'Inglês'];

export function Onboarding() {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('intermediario');
  const [goal, setGoal] = useState(60);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');

  const toggle = (s: string) => setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const finish = (skip = false) => {
    const extra = custom
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const names = skip ? [] : [...new Set([...picked, ...extra])].slice(0, 20);
    setData((d) => ({
      ...d,
      profile: { ...d.profile, name: skip ? d.profile.name : name.trim().slice(0, 60), level, dailyGoalMinutes: goal, onboarded: true },
      subjects: [
        ...d.subjects,
        ...names
          .filter((n) => !d.subjects.some((s) => s.name.toLowerCase() === n.toLowerCase()))
          .map((n, i) => ({ id: uid(), name: n.slice(0, 60), hue: d.subjects.length + i, createdAt: new Date().toISOString() })),
      ],
    }));
  };

  return (
    <Modal title="Bem-vindo ao StudyOS" description="Três ajustes rápidos para personalizar seu painel. Tudo pode ser alterado depois." onClose={() => finish(true)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          finish();
        }}
        className="onboarding"
      >
        <label className="field">
          <span>Como quer ser chamado?</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Seu nome" data-autofocus />
        </label>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Seu nível</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </label>
          <label className="field">
            <span>Meta diária (min)</span>
            <input className="input" type="number" min={10} max={600} step={5} value={goal} onChange={(e) => setGoal(Math.min(600, Math.max(10, Number(e.target.value) || 10)))} />
          </label>
        </div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
          <legend className="field-label" style={{ marginBottom: 8 }}>
            Matérias que você estuda
          </legend>
          <div className="preset-row" style={{ flexWrap: 'wrap' }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="filter-btn" aria-pressed={picked.includes(s)} onClick={() => toggle(s)}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Outras (separadas por vírgula)</span>
          <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ex.: Programação, Filosofia" maxLength={300} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => finish(true)}>
            Pular
          </button>
          <button type="submit" className="btn btn-primary">
            Começar
          </button>
        </div>
      </form>
    </Modal>
  );
}
