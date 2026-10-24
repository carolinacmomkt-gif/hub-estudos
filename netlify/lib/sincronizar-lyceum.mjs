// Sincronização do Lyceum (somente leitura) → Supabase.
// Um login por sincronização; lê boletim (notas e faltas), frequência, avisos e o curso.

import { entrarNoLyceum } from './lyceum.mjs';
import { banco } from './supabase.mjs';
import { melhorCombinacao, nomeBonito, numero, dataIso, textoSemHtml } from './faculdade.mjs';

export class ErroLyceum extends Error {
  constructor(mensagem, motivo) {
    super(mensagem);
    this.motivo = motivo; // 'senha', 'captcha', 'recusado', 'codigos', 'rede'
  }
}

const lista = (v) => (Array.isArray(v) ? v : Array.isArray(v?.content) ? v.content : []);
const sim = (v) => v === true || v === 'S' || v === 's' || v === 'true' || v === 1;

export async function sincronizarLyceum({ userId, matricula, senha }) {
  const sessao = await entrarNoLyceum(matricula, senha);
  if (!sessao.ok) throw new ErroLyceum(sessao.erro, sessao.motivo);

  const bloqueados = [];
  const ler = async (rota) => {
    try {
      return await sessao.ler(rota);
    } catch (erro) {
      bloqueados.push({ metodo: rota, motivo: erro.message });
      return null;
    }
  };
  const [boletim, frequencias, avisos, academicos] = await Promise.all([
    ler('boletim'), ler('frequencias'), ler('avisos'), ler('dadosAcademicos'),
  ]);

  const porCodigoFrequencia = new Map(lista(frequencias).map((f) => [`${f.codDisciplina}|${f.ano}|${f.semestre}`, f]));
  const existentes = await banco.listar('disciplinas', userId);
  const freqExistentes = new Map((await banco.listar('frequencias', userId)).map((f) => [f.origem_id, f]));

  const linhasDisciplinas = [];
  const linhasNotas = [];
  const linhasFrequencia = [];
  const vistas = new Set();

  const itensBoletim = lista(boletim);
  // Se o boletim não vier, a frequência sozinha ainda cria as disciplinas.
  const fontes = itensBoletim.length
    ? itensBoletim
    : lista(frequencias).map((f) => ({ disciplina: f.codDisciplina, nomeDisciplina: f.componenteCurricular, periodo: { ano: f.ano, semestre: f.semestre } }));

  for (const b of fontes) {
    const cod = String(b.disciplina ?? b.codDisciplina ?? '');
    if (!cod) continue;
    const ano = b.periodo?.ano ?? null;
    const semestre = b.periodo?.semestre ?? null;
    const chave = `${cod}|${ano}|${semestre}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    let linha = existentes.find((d) => d.lyceum_cod_disciplina === cod && d.ano === ano && d.semestre === semestre)
      || existentes.find((d) => d.lyceum_cod_disciplina === cod && !d.arquivada);
    if (!linha) {
      linha = melhorCombinacao(b.nomeDisciplina, existentes.filter((d) => !d.lyceum_cod_disciplina && !d.arquivada && !d.combinacao_manual), 'nome_ava');
    }
    const id = linha?.id || crypto.randomUUID();
    if (linha) linha.lyceum_cod_disciplina = cod;

    const faltas = lista(b.faltas)[0] || {};
    const freq = porCodigoFrequencia.get(chave);
    linhasDisciplinas.push({
      id,
      user_id: userId,
      lyceum_cod_disciplina: cod,
      nome_lyceum: b.nomeDisciplina || null,
      nome: nomeBonito(b.nomeDisciplina || linha?.nome_ava || cod),
      turma: b.turma || null,
      professor: b.nomeDocente ? nomeBonito(b.nomeDocente) : null,
      ano,
      semestre,
      arquivada: false,
      dados: {
        media: numero(b.mediaNumerica ?? b.media),
        mediaTexto: b.media ?? null,
        situacao: b.situacaoDetalhe || b.situacaoMatricula || null,
        aulasPrevistas: b.aulasPrevistas ?? freq?.aulasPrevistas ?? null,
        aulasMinistradas: b.aulasMinistradas ?? null,
      },
    });

    for (const p of lista(b.provas)) {
      linhasNotas.push({
        user_id: userId,
        origem_id: `${ano}-${semestre}-${cod}-${p.codigoProva ?? p.ordemProva ?? p.nomeProva}`,
        disciplina_id: id,
        cod_disciplina: cod,
        nome_disciplina: b.nomeDisciplina || null,
        ano,
        semestre,
        prova: p.nomeProva || `Prova ${p.ordemProva ?? ''}`.trim(),
        ordem: numero(p.ordemProva),
        nota: numero(p.nota),
        nota_maxima: numero(p.notaMaxProva),
        oficial: p.provaOficial == null ? null : sim(p.provaOficial),
        data_nota: dataIso(p.dataNota),
      });
    }

    const origemFreq = `${ano}-${semestre}-${cod}`;
    const totalFaltas = numero(faltas.faltasAcumuladas ?? freq?.numeroFaltas);
    const linhaFreq = {
      user_id: userId,
      origem_id: origemFreq,
      disciplina_id: id,
      cod_disciplina: cod,
      nome_disciplina: b.nomeDisciplina || null,
      ano,
      semestre,
      carga_horaria: numero(freq?.cargaHoraria),
      aulas_previstas: numero(b.aulasPrevistas ?? freq?.aulasPrevistas),
      aulas_ministradas: numero(b.aulasMinistradas),
      faltas: totalFaltas,
      faltas_permitidas: numero(faltas.faltasPermitidas),
      percentual_presenca: numero(faltas.percentualPresenca ?? freq?.percentualFrequencia),
    };
    // "Faltei hoje" marcado no app: quando o Lyceum registra a falta, o contador do app diminui.
    const anterior = freqExistentes.get(origemFreq);
    if (anterior?.faltas_manuais && totalFaltas !== null && anterior.faltas !== null && totalFaltas > anterior.faltas) {
      linhaFreq.faltas_manuais = Math.max(0, anterior.faltas_manuais - Math.round(totalFaltas - anterior.faltas));
    }
    linhasFrequencia.push(linhaFreq);
  }

  await banco.gravar('disciplinas', linhasDisciplinas, 'id');
  await banco.gravar('notas_lyceum', linhasNotas, 'user_id,origem_id');
  await banco.gravar('frequencias', linhasFrequencia, 'user_id,origem_id');

  const linhasAvisos = lista(avisos).map((a) => ({
    user_id: userId,
    origem: 'lyceum',
    origem_id: String(a.codAviso ?? `${a.titulo}-${a.data}`),
    titulo: a.tituloClean || a.titulo || 'Aviso',
    texto: textoSemHtml(a.descricao),
    data: dataIso(a.data),
  }));
  await banco.gravar('avisos', linhasAvisos, 'user_id,origem,origem_id');

  // Do curso, só o que aparece na tela (o Lyceum também manda dados pessoais, que não guardamos).
  const curso = academicos ? {
    curso: academicos.curso || null,
    turno: academicos.descrTurno || null,
    serie: academicos.descrSerie || null,
    situacao: academicos.situacaoAluno || null,
  } : null;

  return {
    curso,
    contagens: { disciplinas: linhasDisciplinas.length, notas: linhasNotas.length, avisos: linhasAvisos.length },
    bloqueados,
  };
}
