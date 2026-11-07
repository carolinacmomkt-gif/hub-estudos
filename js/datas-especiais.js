// Datas especiais do Calendário (decisão da Carol, 02/11/2026): feriados com nome (nacionais, Goiás e
// Anápolis), datas da saúde e das profissões para os posts das clientes e as campanhas do mês.
// Calculadas aqui todo ano (nada vai para o banco). Usado pelo app (Calendário, Conteúdo) e pelos avisos.
// Pesquisa feita em 02/11/2026 (leis do Planalto, conselhos e sociedades); "conferir" marca as datas
// em que as fontes divergem.

import { ESPECIALIDADES, especialidadesNoTexto } from './especialidades.js';

// Áreas: as chaves batem com o nicho das clientes (areasDoNicho); uma por especialidade (js/especialidades.js).
const AREAS_BASE = {
  medicina: 'Medicina', saude_mulher: 'Saúde da mulher', saude_homem: 'Saúde do homem', cirurgia_plastica: 'Cirurgia plástica',
};
export const AREAS = { ...AREAS_BASE };
for (const e of ESPECIALIDADES) if (e.areas[0] && !AREAS[e.areas[0]]) AREAS[e.areas[0]] = e.nome;

// [MM-DD, nome, áreas, conferir?]
const PROFISSOES = [
  ['01-18', 'Dia do Esteticista', ['estetica'], 'Sem lei federal; algumas fontes usam 20/11 ou 03/04.'],
  ['01-20', 'Dia do Farmacêutico', ['farmacia']],
  ['02-05', 'Dia do Dermatologista', ['dermatologia'], 'Lei estadual de SP; data da fundação da SBD.'],
  ['02-05', 'Dia do Mastologista', ['mastologia', 'saude_mulher'], 'Data de Santa Águeda; sem fonte da SBM.'],
  ['03-03', 'Dia do Otorrinolaringologista', ['otorrino']],
  ['05-07', 'Dia do Oftalmologista', ['oftalmologia']],
  ['05-12', 'Dia do Enfermeiro', ['enfermagem']],
  ['05-20', 'Dia do Técnico e Auxiliar de Enfermagem', ['enfermagem']],
  ['07-27', 'Dia do Pediatra', ['pediatria']],
  ['08-13', 'Dia do Psiquiatra', ['psiquiatria']],
  ['08-14', 'Dia do Cardiologista', ['cardiologia']],
  ['08-27', 'Dia do Psicólogo', ['psicologia']],
  ['08-31', 'Dia do Nutricionista', ['nutricao']],
  ['09-01', 'Dia do Endocrinologista', ['endocrinologia'], 'Em SP há lei estadual com 11/10.'],
  ['09-12', 'Dia do Urologista', ['urologia', 'saude_homem'], 'Só fontes secundárias.'],
  ['09-19', 'Dia do Ortopedista', ['ortopedia']],
  ['10-13', 'Dia do Fisioterapeuta e do Terapeuta Ocupacional', ['fisioterapia', 'terapia_ocupacional']],
  ['10-16', 'Dia do Anestesiologista', ['anestesiologia']],
  ['10-18', 'Dia do Médico', ['medicina', 'todas']],
  ['10-25', 'Dia do Dentista', ['odontologia']],
  ['10-30', 'Dia do Ginecologista e Obstetra', ['ginecologia', 'obstetricia', 'saude_mulher']],
  ['11-08', 'Dia do Radiologista', ['radiologia']],
  ['11-20', 'Dia do Biomédico', ['biomedicina', 'estetica'], 'Origem da data disputada.'],
  ['12-07', 'Dia do Cirurgião Plástico', ['cirurgia_plastica']],
  ['12-09', 'Dia do Fonoaudiólogo', ['fonoaudiologia']],
  // Pesquisa de 07/11/2026 (leis, sociedades e conselhos; as fracas levam "conferir").
  ['03-16', 'Dia do Clínico Geral', ['clinica_medica', 'familia'], 'As fontes divergem na origem da data.'],
  ['03-23', 'Dia do Acupunturista', ['acupuntura'], 'Lei de SP; há projeto federal com 03/03 para o médico acupunturiatra.'],
  ['04-07', 'Dia do Médico Legista', ['legal'], 'Só fontes secundárias.'],
  ['04-11', 'Dia do Infectologista', ['infectologia']],
  ['04-11', 'Dia do Odontopediatra', ['odontopediatria'], 'Data usada pelo CROSP.'],
  ['04-14', 'Dia do Neurocirurgião', ['neurocirurgia'], 'Em Goiás há lei estadual com 07/04.'],
  ['05-16', 'Dia do Geriatra', ['geriatria'], 'Só projetos de lei estaduais.'],
  ['06-02', 'Dia do Pneumologista', ['pneumologia'], 'Lei de SP, apoiada pela SBPT.'],
  ['07-15', 'Dia do Geneticista', ['genetica'], 'Só fontes secundárias.'],
  ['07-17', 'Dia Nacional do Cirurgião Oncológico', ['cirurgia_oncologica', 'oncologia']],
  ['07-25', 'Dia do Endoscopista', ['endoscopia'], 'Só fontes secundárias (aniversário da SOBED).'],
  ['07-30', 'Dia do Cirurgião', ['cirurgia_geral'], 'Fundação do CBC; há fontes com 29/07.'],
  ['08-05', 'Dia do Patologista', ['patologia', 'patologia_clinica']],
  ['09-09', 'Dia do Fisiatra', ['fisiatria'], 'Só fontes secundárias.'],
  ['09-14', 'Dia do Médico Nuclear', ['nuclear']],
  ['09-15', 'Dia do Nutrólogo', ['nutrologia'], 'Data da ABRAN; só projeto de lei estadual.'],
  ['10-04', 'Dia do Médico do Trabalho', ['trabalho_medicina'], 'Data usada pela categoria, sem lei.'],
  ['10-12', 'Dia do Cirurgião Pediátrico', ['cirurgia_pediatrica'], 'Só fontes secundárias.'],
  ['10-15', 'Dia do Neurologista', ['neurologia', 'neuropediatria'], 'Só projeto de lei estadual e fontes secundárias.'],
  ['10-29', 'Dia do Hematologista', ['hematologia']],
  ['11-10', 'Dia do Intensivista', ['intensiva'], 'Data da campanha da AMIB.'],
  ['11-21', 'Dia Nacional da Homeopatia', ['homeopatia']],
  ['12-05', 'Dia do Médico de Família e Comunidade', ['familia']],
];

// [MM-DD ou regra, nome, áreas, conferir?]
const SAUDE = [
  ['02-04', 'Dia Mundial do Câncer', ['oncologia', 'todas']],
  ['02-05', 'Dia Nacional da Mamografia', ['mastologia', 'radiologia', 'saude_mulher']],
  ['03-04', 'Dia Mundial da Obesidade', ['endocrinologia', 'nutricao', 'nutrologia', 'bariatrica']],
  ['03-08', 'Dia Internacional da Mulher', ['saude_mulher', 'todas']],
  ['sono', 'Dia Mundial do Sono', ['sono', 'neurologia', 'psiquiatria', 'todas'], 'Confira a data no worldsleepday.org.'],
  ['03-13', 'Dia Nacional de Luta contra a Endometriose', ['ginecologia', 'saude_mulher']],
  ['03-20', 'Dia Mundial da Saúde Bucal', ['odontologia']],
  ['04-07', 'Dia Mundial da Saúde', ['todas']],
  ['maes', 'Dia das Mães', ['todas']],
  ['05-31', 'Dia Mundial sem Tabaco', ['pneumologia', 'todas']],
  ['06-25', 'Dia Mundial do Vitiligo', ['dermatologia']],
  ['pais', 'Dia dos Pais', ['saude_homem', 'todas']],
  ['08-29', 'Dia Nacional de Combate ao Fumo', ['todas']],
  ['09-10', 'Dia Mundial de Prevenção do Suicídio', ['psiquiatria', 'psicologia']],
  ['09-17', 'Dia Nacional de Prevenção da Automutilação', ['psiquiatria', 'psicologia']],
  ['09-29', 'Dia Mundial do Coração', ['cardiologia']],
  ['visao', 'Dia Mundial da Visão', ['oftalmologia']],
  ['10-10', 'Dia Mundial da Saúde Mental', ['psiquiatria', 'psicologia']],
  ['10-11', 'Dia Nacional de Prevenção da Obesidade', ['endocrinologia', 'nutricao']],
  ['10-16', 'Dia Mundial da Alimentação', ['nutricao']],
  ['10-18', 'Dia Mundial da Menopausa', ['ginecologia', 'endocrinologia', 'saude_mulher']],
  ['10-25', 'Dia Nacional da Saúde Bucal', ['odontologia']],
  ['10-29', 'Dia Mundial da Psoríase', ['dermatologia']],
  ['11-14', 'Dia Mundial do Diabetes', ['endocrinologia', 'nutricao', 'nutrologia']],
  ['11-19', 'Dia Internacional do Homem', ['saude_homem', 'urologia']],
  ['11-27', 'Dia Nacional de Combate ao Câncer', ['oncologia'], 'Confira no site do INCA.'],
  // Pesquisa de 07/11/2026.
  ['hanseniase', 'Dia Mundial de Combate à Hanseníase', ['dermatologia', 'infectologia']],
  ['02-15', 'Dia Internacional do Câncer Infantil', ['oncologia_pediatrica', 'pediatria', 'oncologia']],
  ['raras', 'Dia Mundial das Doenças Raras', ['genetica', 'neuropediatria']],
  ['03-03', 'Dia Mundial da Audição', ['otorrino', 'fonoaudiologia']],
  ['rim', 'Dia Mundial do Rim', ['nefrologia']],
  ['03-21', 'Dia Internacional da Síndrome de Down', ['genetica', 'neuropediatria', 'pediatria']],
  ['03-24', 'Dia Mundial de Combate à Tuberculose', ['pneumologia', 'infectologia']],
  ['03-26', 'Purple Day: Dia Mundial da Conscientização sobre a Epilepsia', ['neurologia', 'neuropediatria']],
  ['04-02', 'Dia Mundial de Conscientização do Autismo', ['neuropediatria', 'psiquiatria_infantil', 'pediatria', 'psiquiatria', 'psicologia', 'fonoaudiologia', 'terapia_ocupacional']],
  ['04-06', 'Dia Mundial da Atividade Física', ['esportiva', 'fisioterapia', 'cardiologia']],
  ['04-10', 'Dia Mundial da Homeopatia', ['homeopatia']],
  ['04-11', 'Dia Mundial do Parkinson', ['neurologia', 'geriatria']],
  ['04-16', 'Dia Mundial da Voz', ['otorrino', 'fonoaudiologia']],
  ['04-17', 'Dia Mundial da Hemofilia', ['hematologia']],
  ['04-26', 'Dia Nacional de Prevenção e Combate à Hipertensão', ['cardiologia', 'nefrologia', 'clinica_medica']],
  ['04-28', 'Dia Mundial da Segurança e Saúde no Trabalho', ['trabalho_medicina']],
  ['asma', 'Dia Mundial da Asma', ['pneumologia', 'alergia', 'pediatria']],
  ['05-10', 'Dia Mundial do Lúpus', ['reumatologia']],
  ['05-12', 'Dia Mundial da Fibromialgia', ['reumatologia', 'dor']],
  ['05-17', 'Dia Mundial da Hipertensão', ['cardiologia', 'nefrologia', 'clinica_medica']],
  ['05-19', 'Dia Mundial da Doença Inflamatória Intestinal', ['gastroenterologia', 'coloproctologia']],
  ['05-25', 'Dia Mundial da Tireoide', ['endocrinologia', 'cabeca_pescoco']],
  ['05-26', 'Dia Nacional de Combate ao Glaucoma', ['oftalmologia']],
  ['05-29', 'Dia Mundial da Saúde Digestiva', ['gastroenterologia', 'endoscopia', 'hepatologia']],
  ['06-14', 'Dia Mundial do Doador de Sangue', ['hematologia', 'todas']],
  ['07-05', 'Dia Nacional de Conscientização sobre a Dor Crônica', ['dor', 'reumatologia', 'acupuntura', 'fisiatria'], 'Lei nova (2026); confira antes do primeiro post.'],
  ['07-08', 'Dia Mundial da Alergia', ['alergia']],
  ['07-27', 'Dia Mundial do Câncer de Cabeça e Pescoço', ['cabeca_pescoco', 'oncologia']],
  ['07-28', 'Dia Mundial de Luta contra as Hepatites Virais', ['hepatologia', 'gastroenterologia', 'infectologia']],
  ['08-01', 'Semana Nacional de Conscientização sobre o TDAH', ['neuropediatria', 'psiquiatria_infantil', 'psiquiatria'], 'É uma semana que inclui 01/08 (Lei 14.420/2022); confira os dias.'],
  ['08-08', 'Dia Nacional de Combate ao Colesterol', ['cardiologia', 'nutrologia', 'endocrinologia']],
  ['09-04', 'Dia Mundial da Saúde Sexual', ['urologia', 'ginecologia', 'reproducao']],
  ['09-09', 'Dia Latino-Americano da Epilepsia', ['neurologia', 'neuropediatria'], 'Sem lei federal (lei de SP).'],
  ['09-17', 'Dia Mundial da Segurança do Paciente', ['enfermagem', 'intensiva', 'anestesiologia']],
  ['09-21', 'Dia Mundial do Alzheimer', ['geriatria', 'neurologia']],
  ['10-01', 'Dia Internacional da Pessoa Idosa', ['geriatria']],
  ['10-06', 'Dia Mundial da Paralisia Cerebral', ['neuropediatria', 'fisiatria', 'fisioterapia', 'terapia_ocupacional']],
  ['10-12', 'Dia das Crianças', ['pediatria', 'odontopediatria', 'neuropediatria']],
  ['10-12', 'Dia Mundial da Artrite', ['reumatologia', 'ortopedia']],
  ['10-15', 'Dia Mundial da Lavagem das Mãos', ['infectologia', 'pediatria']],
  ['10-20', 'Dia Mundial da Osteoporose', ['reumatologia', 'ortopedia', 'geriatria', 'endocrinologia']],
  ['10-29', 'Dia Mundial do AVC', ['neurologia', 'cardiologia', 'fisiatria', 'emergencia']],
  ['10-30', 'Dia Nacional de Luta contra o Reumatismo', ['reumatologia']],
  ['11-17', 'Dia Mundial da Prematuridade', ['neonatologia', 'pediatria', 'obstetricia']],
  ['dpoc', 'Dia Mundial da DPOC', ['pneumologia']],
  ['11-23', 'Dia Nacional de Combate ao Câncer Infantil', ['oncologia_pediatrica', 'pediatria', 'oncologia']],
  ['12-01', 'Dia Mundial de Luta contra a Aids', ['infectologia']],
  ['12-03', 'Dia Internacional da Pessoa com Deficiência', ['fisiatria', 'neuropediatria', 'terapia_ocupacional', 'fisioterapia']],
];

// [mês, nome, tema, áreas]
const CAMPANHAS = [
  [1, 'Janeiro Branco', 'saúde mental', ['psiquiatria', 'psicologia']],
  [1, 'Janeiro Roxo', 'hanseníase', ['dermatologia', 'infectologia']],
  [10, 'Outubro: mês do TDAH', 'conscientização sobre o TDAH', ['neuropediatria', 'psiquiatria_infantil', 'psiquiatria']],
  [2, 'Fevereiro Roxo', 'lúpus, Alzheimer e fibromialgia', ['neurologia', 'geriatria', 'reumatologia']],
  [2, 'Fevereiro Laranja', 'leucemia e doação de medula', ['oncologia', 'hematologia']],
  [3, 'Março Lilás', 'câncer do colo do útero', ['ginecologia', 'saude_mulher']],
  [3, 'Março Amarelo', 'endometriose', ['ginecologia', 'saude_mulher']],
  [3, 'Março Azul-marinho', 'câncer colorretal', ['oncologia', 'coloproctologia', 'gastroenterologia']],
  [4, 'Abril Azul', 'autismo', ['neuropediatria', 'psiquiatria_infantil', 'pediatria', 'psiquiatria', 'psicologia', 'fonoaudiologia', 'terapia_ocupacional']],
  [4, 'Abril Verde', 'segurança e saúde no trabalho', ['trabalho_medicina', 'todas']],
  [5, 'Maio Amarelo', 'segurança no trânsito', ['todas']],
  [5, 'Maio Roxo', 'doenças inflamatórias intestinais', ['gastroenterologia', 'coloproctologia', 'medicina']],
  [6, 'Junho Vermelho', 'doação de sangue', ['todas']],
  [6, 'Junho Laranja', 'anemia e leucemia', ['oncologia', 'hematologia']],
  [6, 'Junho: mês da infertilidade', 'conscientização sobre a infertilidade', ['reproducao', 'ginecologia']],
  [7, 'Julho Amarelo', 'hepatites virais', ['hepatologia', 'gastroenterologia', 'infectologia', 'medicina']],
  [8, 'Agosto Dourado', 'aleitamento materno', ['obstetricia', 'pediatria', 'saude_mulher', 'nutricao']],
  [8, 'Agosto Lilás', 'enfrentamento da violência contra a mulher', ['saude_mulher', 'psicologia']],
  [9, 'Setembro Amarelo', 'prevenção do suicídio', ['psiquiatria', 'psicologia']],
  [9, 'Setembro Verde', 'doação de órgãos', ['todas']],
  [9, 'Setembro Vermelho', 'saúde do coração', ['cardiologia', 'cardiologia_pediatrica']],
  [10, 'Outubro Rosa', 'câncer de mama', ['mastologia', 'ginecologia', 'saude_mulher', 'oncologia']],
  [11, 'Novembro Azul', 'saúde do homem e câncer de próstata', ['urologia', 'saude_homem']],
  [11, 'Novembro Roxo', 'prematuridade', ['neonatologia', 'pediatria', 'obstetricia']],
  [11, 'Mês da Hiperidrose', 'conscientização sobre a hiperidrose', ['hiperidrose', 'dermatologia']],
  [12, 'Dezembro Vermelho', 'HIV/aids e outras ISTs', ['infectologia', 'todas']],
  [12, 'Dezembro Laranja', 'câncer de pele', ['dermatologia', 'oncologia']],
];

// [MM-DD ou Páscoa ± dias, nome, tipo] (tipo: feriado | facultativo)
const FERIADOS = {
  nacional: [
    ['01-01', 'Confraternização Universal', 'feriado'],
    [-48, 'Carnaval (segunda)', 'facultativo'],
    [-47, 'Carnaval (terça)', 'facultativo'],
    [-46, 'Quarta-feira de Cinzas (até 14h)', 'facultativo'],
    [-2, 'Sexta-feira Santa (Paixão de Cristo)', 'feriado'],
    [0, 'Páscoa', 'feriado'],
    ['04-21', 'Tiradentes', 'feriado'],
    ['05-01', 'Dia do Trabalho', 'feriado'],
    [60, 'Corpus Christi', 'facultativo'],
    ['09-07', 'Independência do Brasil', 'feriado'],
    ['10-12', 'Nossa Senhora Aparecida', 'feriado'],
    ['10-28', 'Dia do Servidor Público', 'facultativo'],
    ['11-02', 'Finados', 'feriado'],
    ['11-15', 'Proclamação da República', 'feriado'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'feriado'],
    ['12-24', 'Véspera de Natal (à tarde)', 'facultativo'],
    ['12-25', 'Natal', 'feriado'],
    ['12-31', 'Véspera de Ano-Novo (à tarde)', 'facultativo'],
  ],
  goias: [
    ['07-26', 'Fundação da Cidade de Goiás (feriado estadual)', 'feriado'],
    ['10-28', 'Dia do Servidor Público (feriado estadual em Goiás)', 'feriado'],
  ],
  anapolis: [
    ['07-26', "Sant'Ana, padroeira de Anápolis", 'feriado'],
    ['07-31', 'Aniversário de Anápolis', 'feriado'],
  ],
};
const ONDE = { nacional: 'Nacional', goias: 'Goiás', anapolis: 'Anápolis' };

// ---------------------------------------------------------------------------
// Contas de data
// ---------------------------------------------------------------------------

const dd = (n) => String(n).padStart(2, '0');
const chave = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
const diaDoAno = (ano, mmdd) => `${ano}-${mmdd}`;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
const somar = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// n-ésimo dia da semana do mês (semana: 0 = domingo).
function enesimo(ano, mes, semana, n) {
  const primeiro = new Date(ano, mes - 1, 1);
  return new Date(ano, mes - 1, 1 + ((semana - primeiro.getDay() + 7) % 7) + (n - 1) * 7);
}

function regra(ano, r) {
  if (r === 'maes') return chave(enesimo(ano, 5, 0, 2));
  if (r === 'pais') return chave(enesimo(ano, 8, 0, 2));
  if (r === 'visao') return chave(enesimo(ano, 10, 4, 2));
  if (r === 'asma') return chave(enesimo(ano, 5, 2, 1));
  if (r === 'rim') return chave(enesimo(ano, 3, 4, 2));
  if (r === 'dpoc') return chave(enesimo(ano, 11, 3, 3));
  if (r === 'raras') return chave(new Date(ano, 2, 0)); // último dia de fevereiro
  if (r === 'hanseniase') { // último domingo de janeiro
    let d = new Date(ano, 0, 31);
    while (d.getDay() !== 0) d = somar(d, -1);
    return chave(d);
  }
  if (r === 'sono') { // sexta-feira antes do equinócio de março (20/03)
    let d = new Date(ano, 2, 19);
    while (d.getDay() !== 5) d = somar(d, -1);
    return chave(d);
  }
  return null;
}

// Todas as datas do ano: [{ data, titulo, tipo, grupo, areas, onde, detalhe, conferir, id }]
// tipo: feriado | facultativo | profissao | saude | campanha
export function datasDoAno(ano) {
  const saida = [];
  const p = pascoa(ano);
  for (const [grupo, lista] of Object.entries(FERIADOS)) {
    for (const [quando, nome, tipo] of lista) {
      const data = typeof quando === 'number' ? chave(somar(p, quando)) : diaDoAno(ano, quando);
      saida.push({ id: `fer:${grupo}:${data}:${nome}`, data, titulo: nome, tipo, grupo: 'feriados', onde: grupo, detalhe: `${tipo === 'facultativo' ? 'Ponto facultativo' : 'Feriado'} · ${ONDE[grupo]}`, areas: [] });
    }
  }
  for (const [mmdd, nome, areas, conferir] of PROFISSOES) {
    saida.push({ id: `pro:${mmdd}:${nome}`, data: diaDoAno(ano, mmdd), titulo: nome, tipo: 'profissao', grupo: 'profissoes', areas, conferir: conferir || '', detalhe: 'Dia da profissão' });
  }
  for (const [quando, nome, areas, conferir] of SAUDE) {
    const data = /^\d\d-\d\d$/.test(quando) ? diaDoAno(ano, quando) : regra(ano, quando);
    if (data) saida.push({ id: `sau:${quando}:${nome}`, data, titulo: nome, tipo: 'saude', grupo: 'saude', areas, conferir: conferir || '', detalhe: 'Data da saúde' });
  }
  for (const [mes, nome, tema, areas] of CAMPANHAS) {
    saida.push({ id: `cam:${mes}:${nome}`, data: `${ano}-${dd(mes)}-01`, titulo: `${nome} (o mês todo)`, nome, tipo: 'campanha', grupo: 'campanhas', areas, detalhe: `Campanha do mês: ${tema}` });
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data));
}

const cache = new Map();
export function datasEntre(de, ate) {
  const saida = [];
  for (let ano = Number(de.slice(0, 4)); ano <= Number(ate.slice(0, 4)); ano += 1) {
    if (!cache.has(ano)) cache.set(ano, datasDoAno(ano));
    for (const d of cache.get(ano)) if (d.data >= de && d.data <= ate) saida.push(d);
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Clientes: o nicho vira áreas, e cada data diz para quem serve
// ---------------------------------------------------------------------------

// Áreas que não vêm de uma especialidade só.
const EXTRAS_DO_NICHO = [
  [/saude da mulher|mulher/, ['saude_mulher']],
  [/saude do homem/, ['saude_homem']],
  [/medic|clinic|saude/, ['medicina']],
];
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function areasDoNicho(nicho, nome = '') {
  const t = semAcento(nicho);
  const areas = new Set();
  for (const e of especialidadesNoTexto(nicho)) e.areas.forEach((a) => areas.add(a));
  for (const [re, lista] of EXTRAS_DO_NICHO) if (re.test(t)) lista.forEach((a) => areas.add(a));
  // Sem nicho na ficha, "Dr./Dra." no nome conta como medicina (dentista também usa, por isso só sem nicho).
  if (!areas.size && /^\s*dra?\.?\s/i.test(nome)) areas.add('medicina');
  return [...areas];
}

// Para quais clientes a data serve. "todas" = data geral (serve para quem é da saúde).
export function clientesDaData(data, clientes) {
  if (!data.areas?.length) return [];
  return (clientes || []).filter((c) => {
    const areas = c.areas || areasDoNicho(c.dados?.nicho, c.nome);
    if (!areas.length) return false;
    return data.areas.some((a) => a !== 'todas' && areas.includes(a));
  });
}
export const ehGeral = (data) => (data.areas || []).includes('todas');

// ---------------------------------------------------------------------------
// Preferências (config "datas_especiais") e o que entra no Calendário
// ---------------------------------------------------------------------------

export const PREFS_PADRAO = {
  feriados: true, goias: true, anapolis: true, profissoes: true, saude: true, campanhas: true, aniversarios: true,
  soDasClientes: false, avisar: true, antecedencia: 15,
};
export const prefsDatas = (config) => ({ ...PREFS_PADRAO, ...((config || []).find((c) => c.chave === 'datas_especiais' && !c.excluido_em)?.valor || {}) });

export function datasVisiveis(de, ate, prefs, clientes) {
  return datasEntre(de, ate).filter((d) => {
    if (d.grupo === 'feriados') return prefs.feriados && (d.onde === 'nacional' || prefs[d.onde]);
    if (!prefs[d.grupo]) return false;
    if (prefs.soDasClientes) return clientesDaData(d, clientes).length > 0;
    return true;
  });
}
