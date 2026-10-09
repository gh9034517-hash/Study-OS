import type { QuizQuestion } from '../../shared/api';

// Banco local de questões para o modo offline (sem IA). Conteúdo autoral, revisado manualmente.
export interface BankQuestion extends QuizQuestion {
  area: string;
}

const q = (area: string, topic: string, question: string, options: string[], answer: number, explanation: string): BankQuestion => ({
  area,
  topic,
  question,
  options,
  answer,
  explanation,
});

export const QUESTION_BANK: BankQuestion[] = [
  // Matemática
  q('Matemática', 'Equações do 1º grau', 'Qual é a solução de 3x − 7 = 11?', ['x = 4', 'x = 6', 'x = 18/3 + 1', 'x = −6'], 1,
    'Somando 7 aos dois lados: 3x = 18. Dividindo por 3: x = 6. A alternativa "18/3 + 1" resulta em 7, um erro comum ao não isolar x corretamente.'),
  q('Matemática', 'Porcentagem', 'Um produto de R$ 200 recebe aumento de 10% e depois desconto de 10%. Qual o preço final?', ['R$ 200', 'R$ 198', 'R$ 202', 'R$ 180'], 1,
    '200 × 1,10 = 220; 220 × 0,90 = 198. Aumentos e descontos percentuais iguais não se anulam, pois incidem sobre bases diferentes.'),
  q('Matemática', 'Função do 2º grau', 'Quais são as raízes de x² − 5x + 6 = 0?', ['1 e 6', '−2 e −3', '2 e 3', '5 e 6'], 2,
    'Procuramos dois números com soma 5 e produto 6: 2 e 3. Conferindo: 2² − 5·2 + 6 = 0 e 3² − 5·3 + 6 = 0.'),
  q('Matemática', 'Geometria plana', 'Qual é a área de um triângulo com base 10 cm e altura 6 cm?', ['60 cm²', '30 cm²', '16 cm²', '36 cm²'], 1,
    'Área do triângulo = (base × altura) / 2 = (10 × 6) / 2 = 30 cm². 60 cm² seria a área do retângulo correspondente.'),
  q('Matemática', 'Probabilidade', 'Ao lançar um dado comum de 6 faces, qual a probabilidade de sair um número par?', ['1/6', '1/3', '1/2', '2/3'], 2,
    'Os pares são 2, 4 e 6: 3 casos favoráveis em 6 possíveis, ou seja, 3/6 = 1/2.'),
  q('Matemática', 'Potenciação', 'Quanto vale 2³ × 2²?', ['2⁵ = 32', '2⁶ = 64', '4⁵', '2¹ = 2'], 0,
    'Na multiplicação de potências de mesma base, conservamos a base e somamos os expoentes: 2³⁺² = 2⁵ = 32.'),

  // Português
  q('Português', 'Crase', 'Em qual frase o uso da crase está correto?', ['Fui à pé para a escola.', 'Entreguei o livro à ela.', 'Vou à praia amanhã.', 'Começou à chover.'], 2,
    '"Ir a" + "a praia" = "à praia". Não há crase antes de palavra masculina (pé), de pronome pessoal (ela) nem de verbo (chover).'),
  q('Português', 'Classes de palavras', 'Na frase "Ela correu rapidamente", a palavra "rapidamente" é:', ['adjetivo', 'advérbio', 'substantivo', 'preposição'], 1,
    '"Rapidamente" modifica o verbo "correu", indicando modo: é um advérbio de modo.'),
  q('Português', 'Concordância verbal', 'Assinale a frase com concordância verbal correta.', ['Fazem dois anos que me mudei.', 'Houveram muitos problemas.', 'Faz dois anos que me mudei.', 'Existe muitas opções.'], 2,
    '"Fazer" indicando tempo decorrido é impessoal e fica no singular: "Faz dois anos". "Haver" no sentido de existir também é impessoal; já "existir" concorda com o sujeito: "Existem muitas opções".'),
  q('Português', 'Figuras de linguagem', '"Aquele homem é uma muralha" é um exemplo de:', ['metáfora', 'hipérbole', 'eufemismo', 'onomatopeia'], 0,
    'Há uma comparação implícita (sem "como") entre o homem e a muralha: isso é metáfora.'),
  q('Português', 'Interpretação de texto', 'Um texto cujo objetivo principal é convencer o leitor de uma opinião é classificado como:', ['narrativo', 'descritivo', 'dissertativo-argumentativo', 'injuntivo'], 2,
    'O texto dissertativo-argumentativo defende uma tese com argumentos. O injuntivo instrui, o narrativo conta fatos e o descritivo caracteriza.'),

  // Biologia
  q('Biologia', 'Citologia', 'Qual organela é responsável pela respiração celular aeróbica?', ['Ribossomo', 'Mitocôndria', 'Complexo de Golgi', 'Lisossomo'], 1,
    'A mitocôndria realiza o ciclo de Krebs e a cadeia respiratória, produzindo a maior parte do ATP. Ribossomos sintetizam proteínas.'),
  q('Biologia', 'Genética', 'Do cruzamento Aa × Aa, qual a proporção esperada de descendentes aa?', ['1/2', '1/4', '3/4', '0'], 1,
    'O quadro de Punnett gera AA, Aa, Aa e aa: 1 em 4 é aa (25%).'),
  q('Biologia', 'Ecologia', 'Em uma cadeia alimentar, os organismos fotossintetizantes são chamados de:', ['consumidores primários', 'decompositores', 'produtores', 'consumidores secundários'], 2,
    'Produtores (como plantas e algas) convertem energia luminosa em energia química, sustentando a cadeia.'),
  q('Biologia', 'Fisiologia humana', 'Qual é a principal função das hemácias?', ['Defesa contra infecções', 'Coagulação do sangue', 'Transporte de oxigênio', 'Produção de anticorpos'], 2,
    'Hemácias contêm hemoglobina, que transporta O₂. Leucócitos atuam na defesa e plaquetas na coagulação.'),
  q('Biologia', 'Fotossíntese', 'Quais são os produtos da fotossíntese?', ['CO₂ e água', 'Glicose e oxigênio', 'ATP e CO₂', 'Glicose e CO₂'], 1,
    '6CO₂ + 6H₂O + luz → C₆H₁₂O₆ + 6O₂. CO₂ e água são os reagentes.'),

  // Física
  q('Física', 'Cinemática', 'Um carro percorre 120 km em 2 horas. Qual sua velocidade média?', ['240 km/h', '60 km/h', '122 km/h', '30 km/h'], 1,
    'Velocidade média = distância / tempo = 120 km / 2 h = 60 km/h.'),
  q('Física', 'Leis de Newton', 'Qual a força resultante sobre um corpo de 5 kg com aceleração de 2 m/s²?', ['2,5 N', '7 N', '10 N', '3 N'], 2,
    'Pela 2ª Lei de Newton, F = m · a = 5 · 2 = 10 N.'),
  q('Física', 'Energia', 'Ao cair, uma bola (desprezando o atrito com o ar) converte principalmente:', ['energia cinética em potencial', 'energia potencial gravitacional em cinética', 'energia térmica em cinética', 'energia elétrica em potencial'], 1,
    'Ao perder altura, a energia potencial gravitacional diminui e a cinética aumenta; a mecânica total se conserva.'),
  q('Física', 'Eletricidade', 'Um resistor de 10 Ω submetido a 20 V é percorrido por qual corrente?', ['200 A', '0,5 A', '2 A', '30 A'], 2,
    'Lei de Ohm: I = U / R = 20 / 10 = 2 A.'),
  q('Física', 'Ondulatória', 'A unidade de frequência no Sistema Internacional é:', ['metro', 'hertz', 'joule', 'watt'], 1,
    'Frequência é medida em hertz (Hz), equivalente a oscilações por segundo.'),

  // Química
  q('Química', 'Tabela periódica', 'Os elementos de uma mesma família (coluna) da tabela periódica têm em comum:', ['o mesmo número de camadas', 'o mesmo número de elétrons na camada de valência', 'a mesma massa atômica', 'o mesmo número de nêutrons'], 1,
    'Elementos da mesma família têm a mesma configuração na camada de valência, por isso apresentam propriedades químicas semelhantes. Mesmo número de camadas define o período (linha).'),
  q('Química', 'Ligações químicas', 'A ligação entre Na e Cl no sal de cozinha (NaCl) é:', ['covalente', 'metálica', 'iônica', 'de hidrogênio'], 2,
    'O sódio (metal) doa um elétron ao cloro (ametal), formando íons Na⁺ e Cl⁻ unidos por atração eletrostática: ligação iônica.'),
  q('Química', 'pH', 'Uma solução com pH = 3 é:', ['básica', 'neutra', 'ácida', 'salina obrigatoriamente'], 2,
    'A 25 °C, pH < 7 indica solução ácida, pH = 7 neutra e pH > 7 básica.'),
  q('Química', 'Estequiometria', 'Quantos mols de H₂O são formados a partir de 2 mols de H₂ em 2H₂ + O₂ → 2H₂O?', ['1 mol', '2 mols', '4 mols', '3 mols'], 1,
    'A proporção entre H₂ e H₂O é 2 : 2, ou seja, 1 : 1. Logo, 2 mols de H₂ formam 2 mols de H₂O.'),
  q('Química', 'Química orgânica', 'Qual é o elemento químico presente em todos os compostos orgânicos?', ['Oxigênio', 'Nitrogênio', 'Carbono', 'Enxofre'], 2,
    'A química orgânica estuda os compostos de carbono, capaz de formar cadeias estáveis.'),

  // História
  q('História', 'Brasil Colônia', 'Qual foi o primeiro grande ciclo econômico de exportação do Brasil colonial?', ['Café', 'Ouro', 'Pau-brasil', 'Borracha'], 2,
    'A exploração do pau-brasil começou logo após 1500. O açúcar veio em seguida, o ouro no século XVIII e o café no século XIX.'),
  q('História', 'Brasil Império', 'A Lei Áurea, que aboliu a escravidão no Brasil, foi assinada em:', ['1822', '1850', '1888', '1889'], 2,
    'A Lei Áurea foi assinada pela princesa Isabel em 13 de maio de 1888. 1889 é o ano da Proclamação da República.'),
  q('História', 'Revolução Francesa', 'O lema da Revolução Francesa era:', ['Ordem e Progresso', 'Liberdade, Igualdade, Fraternidade', 'Paz, Pão e Terra', 'Deus, Pátria e Família'], 1,
    '"Liberdade, Igualdade, Fraternidade" sintetizava os ideais iluministas da Revolução de 1789. "Paz, Pão e Terra" foi um lema da Revolução Russa.'),
  q('História', 'Guerras Mundiais', 'O estopim da Primeira Guerra Mundial foi:', ['a invasão da Polônia', 'o assassinato do arquiduque Francisco Ferdinando', 'o ataque a Pearl Harbor', 'a queda do Muro de Berlim'], 1,
    'O assassinato do herdeiro austro-húngaro em Sarajevo (1914) desencadeou a guerra. A invasão da Polônia (1939) iniciou a Segunda Guerra.'),
  q('História', 'Era Vargas', 'A Consolidação das Leis do Trabalho (CLT) foi criada durante o governo de:', ['Juscelino Kubitschek', 'Getúlio Vargas', 'Dom Pedro II', 'Fernando Henrique Cardoso'], 1,
    'A CLT foi instituída em 1943, durante o Estado Novo de Getúlio Vargas.'),

  // Geografia
  q('Geografia', 'Climatologia', 'Qual fator explica temperaturas mais baixas em locais de maior altitude?', ['Maior pressão atmosférica', 'Ar mais rarefeito, que retém menos calor', 'Maior proximidade do Sol', 'Maior umidade sempre'], 1,
    'Com a altitude, o ar fica rarefeito e retém menos calor; em média a temperatura cai cerca de 0,6 °C a cada 100 m.'),
  q('Geografia', 'Biomas brasileiros', 'Qual bioma brasileiro é exclusivo do país e típico do semiárido nordestino?', ['Cerrado', 'Pampa', 'Caatinga', 'Pantanal'], 2,
    'A Caatinga ocorre apenas no Brasil e é adaptada ao clima semiárido, com vegetação que perde folhas na seca.'),
  q('Geografia', 'Cartografia', 'Em um mapa de escala 1:100.000, 1 cm no mapa corresponde a quanto na realidade?', ['100 m', '1 km', '10 km', '100 km'], 1,
    '1 cm × 100.000 = 100.000 cm = 1.000 m = 1 km.'),
  q('Geografia', 'Geologia', 'Os terremotos ocorrem principalmente:', ['no centro das placas tectônicas', 'nos limites entre placas tectônicas', 'apenas em regiões frias', 'somente no fundo dos oceanos'], 1,
    'A maior parte dos abalos sísmicos ocorre nos limites entre placas, onde há acúmulo e liberação de tensão.'),
  q('Geografia', 'População', 'O que caracteriza o envelhecimento populacional?', ['Aumento da natalidade', 'Aumento da proporção de idosos na população', 'Redução da expectativa de vida', 'Aumento da mortalidade infantil'], 1,
    'Com queda da natalidade e aumento da expectativa de vida, cresce a participação relativa de idosos.'),

  // Inglês
  q('Inglês', 'Simple past', 'Qual é o passado simples de "go"?', ['goed', 'gone', 'went', 'going'], 2,
    '"Go" é irregular: go – went – gone. "Gone" é o particípio passado.'),
  q('Inglês', 'Present perfect', 'Complete: "She ___ lived here since 2019."', ['have', 'has', 'is', 'was'], 1,
    'Present perfect com sujeito na 3ª pessoa do singular usa "has" + particípio: "She has lived".'),
  q('Inglês', 'Vocabulário', 'A palavra "actually" significa:', ['atualmente', 'na verdade', 'acidentalmente', 'ativamente'], 1,
    '"Actually" é um falso cognato: significa "na verdade". "Atualmente" em inglês é "currently" ou "nowadays".'),
  q('Inglês', 'Comparativos', 'Complete: "This book is ___ than that one."', ['more good', 'gooder', 'better', 'best'], 2,
    '"Good" tem comparativo irregular: good – better – best.'),
];

export const BANK_AREAS = [...new Set(QUESTION_BANK.map((x) => x.area))];

export function pickLocalQuestions(area: string, count: number): QuizQuestion[] {
  const pool = QUESTION_BANK.filter((x) => x.area === area);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((item) => shuffleOptions(item));
}

/** Embaralha as alternativas mantendo o índice da correta. */
export function shuffleOptions(item: QuizQuestion): QuizQuestion {
  const order = item.options.map((_, i) => i).sort(() => Math.random() - 0.5);
  return {
    question: item.question,
    topic: item.topic,
    explanation: item.explanation,
    options: order.map((i) => item.options[i]),
    answer: order.indexOf(item.answer),
  };
}
