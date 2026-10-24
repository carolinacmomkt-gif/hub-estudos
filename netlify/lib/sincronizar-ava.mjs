// Sincronização do AVA (somente leitura) → Supabase.
//
// Dividida em partes para caber no tempo das funções da Netlify (~10 s):
// - geral: quais disciplinas estão em andamento, trabalhos e quizzes (com a situação das
//   pendências do calendário) e outros eventos do calendário;
// - cursos (até 2 por vez): status de entrega de cada trabalho, avisos, materiais e notas.
// Métodos bloqueados (accessexception) entram em "bloqueados" e o resto continua.

import { chamarAva, ErroAva } from './ava.mjs';
import { banco } from './supabase.mjs';
import { emParalelo, melhorCombinacao, nomeBonito, dataIso, textoSemHtml, tipoPeloNome, numero } from './faculdade.mjs';

const DIA = 24 * 60 * 60 * 1000;
const MODULOS_DE_MATERIAL = new Set(['resource', 'url', 'page', 'folder', 'book']);
export const CURSOS_POR_PARTE = 2;

// Executa uma consulta; se o método estiver bloqueado ou falhar, anota e devolve null.
// Token vencido não é engolido: interrompe a sincronização para pedir reconexão.
async function tentar(nome, bloqueados, fn) {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroAva && erro.codigo === 'token') throw erro;
    bloqueados.push({ metodo: nome, motivo: erro.message });
    return null;
  }
}

// Reserva, se o AVA não disser quais cursos estão em andamento: datas e último acesso.
function pareceAtivo(curso, agora) {
  if (curso.visible === 0) return false;
  if (curso.lastaccess && curso.lastaccess * 1000 >= agora - 120 * DIA) return true;
  if (curso.enddate) return curso.enddate * 1000 >= agora - 15 * DIA;
  return !curso.startdate || curso.startdate * 1000 >= agora - 300 * DIA;
}

const linkDe = (base) => (caminho) => `${base}${caminho}`;

export async function sincronizarAvaGeral({ userId, base, token, avaUserId }) {
  const agora = Date.now();
  const bloqueados = [];
  const contagens = {};
  const link = linkDe(base);

  // 1. Disciplinas: o próprio AVA diz quais estão "em andamento" (como na página inicial do Moodle).
  const [cursos, classificacao] = await Promise.all([
    chamarAva(base, token, 'core_enrol_get_users_courses', { userid: avaUserId }),
    tentar('core_course_get_enrolled_courses_by_timeline_classification', bloqueados, () => chamarAva(base, token,
      'core_course_get_enrolled_courses_by_timeline_classification', { classification: 'inprogress', limit: 0, offset: 0 })),
  ]);
  const emAndamento = new Set((classificacao?.courses || []).map((c) => c.id));
  const ativo = (curso) => (emAndamento.size ? emAndamento.has(curso.id) : pareceAtivo(curso, agora));

  const existentes = await banco.listar('disciplinas', userId);
  const limpezas = [];
  const linhasDisciplinas = [];
  const idPorCurso = new Map();
  for (const curso of cursos || []) {
    const estaAtivo = ativo(curso);
    let linha = existentes.find((d) => Number(d.ava_course_id) === curso.id);
    if (estaAtivo && !linha?.lyceum_cod_disciplina && !linha?.combinacao_manual) {
      // Combina com a disciplina que veio do Lyceum (nome oficial), se houver.
      const doLyceum = melhorCombinacao(curso.fullname, existentes.filter((d) => d.lyceum_cod_disciplina && !d.ava_course_id && !d.arquivada), 'nome_lyceum');
      if (doLyceum) {
        // A linha antiga, só do AVA, sai (primeiro solta o código do curso, que é único).
        if (linha) limpezas.push(linha.id);
        linha = doLyceum;
      }
    }
    const id = linha?.id || crypto.randomUUID();
    idPorCurso.set(curso.id, id);
    linhasDisciplinas.push({
      id,
      user_id: userId,
      ava_course_id: curso.id,
      nome_ava: curso.fullname,
      nome: nomeBonito(linha?.nome_lyceum || curso.fullname),
      arquivada: !estaAtivo,
    });
    if (linha) linha.ava_course_id = curso.id; // não combinar a mesma linha duas vezes
  }
  for (const id of limpezas) {
    await banco.atualizarPorId('disciplinas', userId, id, { ava_course_id: null, excluido_em: new Date().toISOString() });
  }
  await banco.gravar('disciplinas', linhasDisciplinas, 'id');
  const ativos = (cursos || []).filter(ativo).map((c) => c.id);
  contagens.cursosNoAva = (cursos || []).length;
  contagens.disciplinas = ativos.length;

  // 2. Pendências do calendário (o que ainda falta fazer e o que está atrasado)
  const acoes = await tentar('core_calendar_get_action_events_by_timesort', bloqueados, () => chamarAva(base, token, 'core_calendar_get_action_events_by_timesort', {
    timesortfrom: Math.floor((agora - 30 * DIA) / 1000),
    limitnum: 50,
  }));
  const pendencias = new Map();
  for (const ev of acoes?.events || []) pendencias.set(`${ev.modulename}-${ev.instance}`, ev);

  const eventos = [];
  if (ativos.length) {
    // 3. Trabalhos (o status de entrega de cada um vem na parte por curso)
    const tarefas = await tentar('mod_assign_get_assignments', bloqueados, () => chamarAva(base, token, 'mod_assign_get_assignments', { courseids: ativos }));
    for (const c of tarefas?.courses || []) {
      for (const a of c.assignments || []) {
        if (!a.duedate || a.duedate * 1000 < agora - 60 * DIA) continue;
        const pendencia = pendencias.get(`assign-${a.id}`);
        const evento = {
          user_id: userId,
          origem: 'ava',
          origem_id: `assign-${a.id}`,
          disciplina_id: idPorCurso.get(a.course || c.id) || null,
          tipo: tipoPeloNome(a.name, 'trabalho') === 'prova' ? 'prova' : 'trabalho',
          titulo: a.name,
          inicio: dataIso(a.duedate),
          link: link(`/mod/assign/view.php?id=${a.cmid}`),
        };
        // Sem pendência não dá para saber aqui: o status fica como estava até a parte por curso.
        if (pendencia) evento.status = pendencia.overdue ? 'atrasado' : 'pendente';
        eventos.push(evento);
      }
    }

    // 4. Quizzes (provas e questionários online)
    const quizzes = await tentar('mod_quiz_get_quizzes_by_courses', bloqueados, () => chamarAva(base, token, 'mod_quiz_get_quizzes_by_courses', { courseids: ativos }));
    for (const q of quizzes?.quizzes || []) {
      const quando = q.timeclose || q.timeopen;
      if (!quando || quando * 1000 < agora - 60 * DIA) continue;
      const pendencia = pendencias.get(`quiz-${q.id}`);
      let situacao = null;
      if (pendencia) situacao = pendencia.overdue ? 'atrasado' : 'pendente';
      else if (q.timeopen && q.timeopen * 1000 > agora) situacao = 'pendente'; // ainda não abriu
      else if (quando * 1000 >= agora) situacao = acoes ? 'entregue' : 'pendente'; // aberto e sem pendência = já respondido
      eventos.push({
        user_id: userId,
        origem: 'ava',
        origem_id: `quiz-${q.id}`,
        disciplina_id: idPorCurso.get(q.course) || null,
        tipo: tipoPeloNome(q.name, 'atividade'),
        titulo: q.name,
        inicio: dataIso(quando),
        status: situacao,
        link: link(`/mod/quiz/view.php?id=${q.coursemodule}`),
      });
    }
  }

  // 5. Outros eventos do calendário (do curso, da instituição, pessoais)
  const proximos = await tentar('core_calendar_get_calendar_upcoming_view', bloqueados, () => chamarAva(base, token, 'core_calendar_get_calendar_upcoming_view', {}));
  for (const ev of proximos?.events || []) {
    if (ev.modulename === 'assign' || ev.modulename === 'quiz') continue; // já vieram acima
    const cursoId = ev.course?.id || ev.courseid;
    eventos.push({
      user_id: userId,
      origem: 'ava',
      origem_id: `evento-${ev.id}`,
      disciplina_id: idPorCurso.get(cursoId) || null,
      tipo: tipoPeloNome(ev.name, 'atividade'),
      titulo: ev.name,
      descricao: textoSemHtml(ev.description, 500) || null,
      inicio: dataIso(ev.timestart),
      fim: ev.timeduration ? dataIso(ev.timestart + ev.timeduration) : null,
      link: ev.url || null,
    });
  }
  await banco.gravar('eventos', eventos.filter((e) => e.inicio), 'user_id,origem,origem_id');
  contagens.eventos = eventos.length;

  return { cursos: ativos, contagens, bloqueados };
}

export async function sincronizarAvaCursos({ userId, base, token, avaUserId, cursos }) {
  const agora = Date.now();
  const bloqueados = [];
  const contagens = { materiais: 0, notas: 0, avisos: 0, entregas: 0 };
  const link = linkDe(base);
  const lista = cursos.slice(0, CURSOS_POR_PARTE);
  const disciplinas = await banco.listar('disciplinas', userId);
  const idPorCurso = new Map(disciplinas.filter((d) => d.ava_course_id).map((d) => [Number(d.ava_course_id), d.id]));

  // Fóruns de avisos e trabalhos dos cursos desta parte (uma chamada cada)
  const [foruns, tarefas] = await Promise.all([
    tentar('mod_forum_get_forums_by_courses', bloqueados, () => chamarAva(base, token, 'mod_forum_get_forums_by_courses', { courseids: lista })),
    tentar('mod_assign_get_assignments', bloqueados, () => chamarAva(base, token, 'mod_assign_get_assignments', { courseids: lista })),
  ]);

  // Status de entrega de cada trabalho (do último mês e dos próximos)
  const listaTarefas = (tarefas?.courses || []).flatMap((c) => (c.assignments || []).map((a) => ({ ...a, course: a.course || c.id })))
    .filter((a) => a.duedate && a.duedate * 1000 >= agora - 60 * DIA);
  const status = await emParalelo(listaTarefas, 6, async (a) => {
    const r = await chamarAva(base, token, 'mod_assign_get_submission_status', { assignid: a.id });
    return r?.lastattempt?.submission?.status || r?.lastattempt?.teamsubmission?.status || 'new';
  });
  const entregas = [];
  listaTarefas.forEach((a, i) => {
    const r = status[i];
    if (r?.erro) {
      if (r.erro instanceof ErroAva && r.erro.codigo === 'token') throw r.erro;
      return; // fica o status que veio das pendências do calendário
    }
    entregas.push({
      user_id: userId,
      origem: 'ava',
      origem_id: `assign-${a.id}`,
      status: r === 'submitted' ? 'entregue' : a.duedate * 1000 < agora ? 'atrasado' : 'pendente',
    });
  });
  if (status.some((s) => s?.erro)) bloqueados.push({ metodo: 'mod_assign_get_submission_status', motivo: 'Alguns status de entrega não vieram.' });
  // Só atualiza o status (os trabalhos já foram gravados na parte geral).
  await banco.atualizarStatus('eventos', entregas);
  contagens.entregas = entregas.length;

  // Avisos (fóruns de notícias)
  const deAvisos = (Array.isArray(foruns) ? foruns : []).filter((f) => f.type === 'news');
  const discussoes = await emParalelo(deAvisos, 4, (f) => chamarAva(base, token, 'mod_forum_get_forum_discussions', { forumid: f.id, page: 0, perpage: 10 }));
  const avisos = [];
  deAvisos.forEach((forum, i) => {
    for (const d of discussoes[i]?.discussions || []) {
      avisos.push({
        user_id: userId,
        origem: 'ava',
        origem_id: `forum-${d.discussion || d.id}`,
        disciplina_id: idPorCurso.get(forum.course) || null,
        titulo: d.subject || d.name || 'Aviso',
        texto: textoSemHtml(d.message),
        data: dataIso(d.created || d.timemodified),
        link: link(`/mod/forum/discuss.php?d=${d.discussion || d.id}`),
      });
    }
  });
  if (discussoes.some((d) => d?.erro)) bloqueados.push({ metodo: 'mod_forum_get_forum_discussions', motivo: 'Alguns avisos não vieram.' });
  await banco.gravar('avisos', avisos, 'user_id,origem,origem_id');
  contagens.avisos = avisos.length;

  // Materiais e notas de cada curso
  await emParalelo(lista, 2, async (cursoId) => {
    const disciplinaId = idPorCurso.get(cursoId) || null;
    const [conteudo, notas] = await Promise.all([
      tentar('core_course_get_contents', bloqueados, () => chamarAva(base, token, 'core_course_get_contents', { courseid: cursoId })),
      tentar('gradereport_user_get_grade_items', bloqueados, () => chamarAva(base, token, 'gradereport_user_get_grade_items', { courseid: cursoId, userid: avaUserId })),
    ]);

    const materiais = [];
    for (const secao of Array.isArray(conteudo) ? conteudo : []) {
      for (const m of secao.modules || []) {
        if (!MODULOS_DE_MATERIAL.has(m.modname) || m.uservisible === false) continue;
        const arquivos = (m.contents || []).filter((c) => c.type === 'file').slice(0, 10)
          .map((c) => ({ nome: c.filename, tipo: c.mimetype || null, tamanho: c.filesize || null, url: c.fileurl || null }));
        const externo = m.modname === 'url' ? (m.contents || [])[0]?.fileurl || null : null;
        materiais.push({
          user_id: userId,
          origem: 'ava',
          origem_id: `mod-${m.id}`,
          disciplina_id: disciplinaId,
          titulo: m.name,
          tipo: m.modname,
          url: m.url || null,
          dados: { secao: secao.name || null, arquivos, linkExterno: externo },
        });
      }
    }
    await banco.gravar('materiais', materiais, 'user_id,origem,origem_id');
    contagens.materiais += materiais.length;

    const itens = notas?.usergrades?.[0]?.gradeitems || [];
    const linhasNotas = itens
      .filter((g) => g.graderaw !== null && g.graderaw !== undefined && g.itemtype !== 'category')
      .map((g) => ({
        user_id: userId,
        origem_id: `${cursoId}-${g.id}`,
        disciplina_id: disciplinaId,
        ava_course_id: cursoId,
        item: g.itemtype === 'course' ? 'Total da disciplina' : (g.itemname || 'Nota'),
        nota: numero(g.graderaw),
        nota_maxima: numero(g.grademax),
        peso: numero(g.weightraw),
        data: dataIso(g.gradedategraded || g.gradedatesubmitted),
      }));
    await banco.gravar('notas_ava', linhasNotas, 'user_id,origem_id');
    contagens.notas += linhasNotas.length;
  });

  return { contagens, bloqueados };
}
