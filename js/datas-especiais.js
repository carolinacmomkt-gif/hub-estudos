// Datas especiais do Calendário (decisão da Carol, 02/11/2026): feriados com nome (nacionais, Goiás e
// Anápolis), datas da saúde e das profissões para os posts das clientes e as campanhas do mês.
// Calculadas aqui todo ano (nada vai para o banco). Usado pelo app (Calendário, Conteúdo) e pelos avisos.
// Pesquisa feita em 02/11/2026 (leis do Planalto, conselhos e sociedades); "conferir" marca as datas
// em que as fontes divergem.

// Áreas: as chaves batem com o nicho das clientes (areasDoNicho).
export const AREAS = {
  medicina: 'Medicina', ginecologia: 'Ginecologia', obstetricia: 'Obstetrícia', dermatologia: 'Dermatologia', estetica: 'Estética',
  odontologia: 'Odontologia', oftalmologia: 'Oftalmologia', psiquiatria: 'Psiquiatria', psicologia: 'Psicologia', nutricao: 'Nutrição',
  fisioterapia: 'Fisioterapia', enfermagem: 'Enfermagem', farmacia: 'Farmácia', pediatria: 'Pediatria', cardiologia: 'Cardiologia',
  endocrinologia: 'Endocrinologia', ortopedia: 'Ortopedia', urologia: 'Urologia', oncologia: 'Oncologia', neurologia: 'Neurologia',
  cirurgia_plastica: 'Cirurgia plástica', biomedicina: 'Biomedicina', fonoaudiologia: 'Fonoaudiologia', radiologia: 'Radiologia',
  anestesiologia: 'Anestesiologia', otorrino: 'Otorrinolaringologia', geriatria: 'Geriatria', mastologia: 'Mastologia',
  hiperidrose: 'Hiperidrose', integrativa: 'Medicina integrativa', saude_mulher: 'Saúde da mulher', saude_homem: 'Saúde do homem',
};

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
  ['10-13', 'Dia do Fisioterapeuta e do Terapeuta Ocupacional', ['fisioterapia']],
  ['10-16', 'Dia do Anestesiologista', ['anestesiologia']],
  ['10-18', 'Dia do Médico', ['medicina', 'todas']],
  ['10-25', 'Dia do Dentista', ['odontologia']],
  ['10-30', 'Dia do Ginecologista e Obstetra', ['ginecologia', 'obstetricia', 'saude_mulher']],
  ['11-08', 'Dia do Radiologista', ['radiologia']],
  ['11-20', 'Dia do Biomédico', ['biomedicina', 'estetica'], 'Origem da data disputada.'],
  ['12-07', 'Dia do Cirurgião Plástico', ['cirurgia_plastica']],
  ['12-09', 'Dia do Fonoaudiólogo', ['fonoaudiologia']],
];

// [MM-DD ou regra, nome, áreas, conferir?]
const SAUDE = [
  ['02-04', 'Dia Mundial do Câncer', ['oncologia', 'todas']],
  ['02-05', 'Dia Nacional da Mamografia', ['mastologia', 'radiologia', 'saude_mulher']],
  ['03-04', 'Dia Mundial da Obesidade', ['endocrinologia', 'nutricao']],
  ['03-08', 'Dia Internacional da Mulher', ['saude_mulher', 'todas']],
  ['sono', 'Dia Mundial do Sono', ['neurologia', 'psiquiatria', 'todas'], 'Confira a data no worldsleepday.org.'],
  ['03-13', 'Dia Nacional de Luta contra a Endometriose', ['ginecologia', 'saude_mulher']],
  ['03-20', 'Dia Mundial da Saúde Bucal', ['odontologia']],
  ['04-07', 'Dia Mundial da Saúde', ['todas']],
  ['maes', 'Dia das Mães', ['todas']],
  ['05-31', 'Dia Mundial sem Tabaco', ['todas']],
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
  ['11-14', 'Dia Mundial do Diabetes', ['endocrinologia', 'nutricao']],
  ['11-19', 'Dia Internacional do Homem', ['saude_homem', 'urologia']],
  ['11-27', 'Dia Nacional de Combate ao Câncer', ['oncologia'], 'Confira no site do INCA.'],
];

// [mês, nome, tema, áreas]
const CAMPANHAS = [
  [1, 'Janeiro Branco', 'saúde mental', ['psiquiatria', 'psicologia']],
  [2, 'Fevereiro Roxo', 'lúpus, Alzheimer e fibromialgia', ['neurologia', 'geriatria']],
  [2, 'Fevereiro Laranja', 'leucemia e doação de medula', ['oncologia']],
  [3, 'Março Lilás', 'câncer do colo do útero', ['ginecologia', 'saude_mulher']],
  [3, 'Março Amarelo', 'endometriose', ['ginecologia', 'saude_mulher']],
  [3, 'Março Azul-marinho', 'câncer colorretal', ['oncologia']],
  [4, 'Abril Azul', 'autismo', ['pediatria', 'psiquiatria', 'psicologia', 'fonoaudiologia']],
  [4, 'Abril Verde', 'segurança e saúde no trabalho', ['todas']],
  [5, 'Maio Amarelo', 'segurança no trânsito', ['todas']],
  [5, 'Maio Roxo', 'doenças inflamatórias intestinais', ['medicina']],
  [6, 'Junho Vermelho', 'doação de sangue', ['todas']],
  [6, 'Junho Laranja', 'anemia e leucemia', ['oncologia']],
  [7, 'Julho Amarelo', 'hepatites virais', ['medicina']],
  [8, 'Agosto Dourado', 'aleitamento materno', ['obstetricia', 'pediatria', 'saude_mulher', 'nutricao']],
  [8, 'Agosto Lilás', 'enfrentamento da violência contra a mulher', ['saude_mulher', 'psicologia']],
  [9, 'Setembro Amarelo', 'prevenção do suicídio', ['psiquiatria', 'psicologia']],
  [9, 'Setembro Verde', 'doação de órgãos', ['todas']],
  [9, 'Setembro Vermelho', 'saúde do coração', ['cardiologia']],
  [10, 'Outubro Rosa', 'câncer de mama', ['mastologia', 'ginecologia', 'saude_mulher', 'oncologia']],
  [11, 'Novembro Azul', 'saúde do homem e câncer de próstata', ['urologia', 'saude_homem']],
  [11, 'Novembro Roxo', 'prematuridade', ['pediatria', 'obstetricia']],
  [11, 'Mês da Hiperidrose', 'conscientização sobre a hiperidrose', ['hiperidrose', 'dermatologia']],
  [12, 'Dezembro Vermelho', 'HIV/aids e outras ISTs', ['todas']],
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

const NICHOS = [
  [/ginec|obstet|gestant|fertil/, ['ginecologia', 'obstetricia', 'saude_mulher', 'medicina']],
  [/mastolog|mama/, ['mastologia', 'saude_mulher', 'medicina']],
  [/dermat|pele|tricolog|cabel/, ['dermatologia', 'medicina']],
  [/hiperidrose|suor|sudorese/, ['hiperidrose', 'dermatologia', 'medicina']],
  [/estet|harmoniza|biomed/, ['estetica']],
  [/odonto|dent|ortodont|bucal|halit/, ['odontologia']],
  [/oftalm|olho|visao|retina/, ['oftalmologia', 'medicina']],
  [/psiquiat/, ['psiquiatria', 'medicina']],
  [/psicolog|terapia|saude mental/, ['psicologia']],
  [/nutri|aliment|emagrec/, ['nutricao']],
  [/fisioter|pilates|reabilit/, ['fisioterapia']],
  [/enferm/, ['enfermagem']],
  [/farmac/, ['farmacia']],
  [/pediat|infantil|crianc/, ['pediatria', 'medicina']],
  [/cardio|coracao/, ['cardiologia', 'medicina']],
  [/endocrin|hormon|tireoid|diabet|metabol/, ['endocrinologia', 'medicina']],
  [/ortoped|coluna|joelho/, ['ortopedia', 'medicina']],
  [/urolog|prostat/, ['urologia', 'saude_homem', 'medicina']],
  [/oncolog|cancer/, ['oncologia', 'medicina']],
  [/neurolog|sono/, ['neurologia', 'medicina']],
  [/plastic/, ['cirurgia_plastica', 'medicina']],
  [/fonoaud/, ['fonoaudiologia']],
  [/radiolog|imagem/, ['radiologia', 'medicina']],
  [/anestes/, ['anestesiologia', 'medicina']],
  [/otorrino/, ['otorrino', 'medicina']],
  [/geriat|idoso|longevid/, ['geriatria', 'medicina']],
  [/integrativ|funcional|ortomolec/, ['integrativa', 'medicina']],
  [/medic|clinic|saude/, ['medicina']],
];
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function areasDoNicho(nicho, nome = '') {
  const t = semAcento(nicho);
  const areas = new Set();
  for (const [re, lista] of NICHOS) if (re.test(t)) lista.forEach((a) => areas.add(a));
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
