// Paleta fixa de identidade das matérias (atribuída em ordem, nunca gerada).
export const SUBJECT_COLORS = ['#5d8dff', '#34d3c5', '#f5a524', '#e879f9', '#a3e635', '#fb7185', '#38bdf8', '#c4b5fd'];

export const subjectColor = (hue: number | undefined) => SUBJECT_COLORS[(hue ?? 0) % SUBJECT_COLORS.length];
