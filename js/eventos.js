// Cliques, formulários e interações globais (delegação no documento).

import { definirTema } from './tema.js';
import { definirTamanhoTexto } from './preferencias.js';
import { obterEstado, atualizarEstado } from './estado.js';
import { entrarComSenha, sair } from './nuvem.js';
import {
  salvar, obter, sincronizar, situacaoSincronizacao, exportarBackup, importarBackup, apagarDadosLocais,
} from './persistencia.js';
import { conectarAva, conectarLyceum, desconectar } from './funcoes.js';
import { renderCarregando, renderResultadoAva, renderResultadoLyceum } from './views-configuracoes.js';
import { renderFolhaCriar } from './views-criar.js';
import { esc } from './utilidades.js';
import { sincronizarFaculdade } from './faculdade-sinc.js';
import { atualizarResultadoCalculadora } from './views-faculdade.js';
import { listar } from './persistencia.js';
import { ligarCalendario, cliqueCalendario, enviarCalendario, mudancaCalendario } from './eventos-calendario.js';
import { ligarAvisos, cliqueAvisos, enviarAvisos, mudancaAvisos } from './eventos-avisos.js';
import { ligarInicio, cliqueInicio, enviarInicio, mudancaInicio } from './eventos-inicio.js';

let app; // { renderizar, mostrarLogin, entrarNoApp }

function avisoCurto(texto) {
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = `<span>${esc(texto)}</span>`;
  aviso.hidden = false;
  clearTimeout(avisoCurto.tempo);
  avisoCurto.tempo = setTimeout(() => {
    aviso.hidden = true;
  }, 3500);
}

// Marca a tela como ocupada durante uma operação, para ela não ser redesenhada no meio.
async function ocupado(fn) {
  atualizarEstado({ ocupado: true });
  try {
    return await fn();
  } finally {
    atualizarEstado({ ocupado: false });
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

async function entrar(form) {
  const email = form.elements.email.value.trim();
  const senha = form.elements.senha.value;
  if (!/^\S+@\S+\.\S+$/.test(email) || !senha) {
    app.mostrarLogin({ email, erro: 'Preencha o e-mail e a senha.' });
    return;
  }
  form.querySelector('[type="submit"]').disabled = true;
  try {
    await entrarComSenha(email, senha);
    await app.entrarNoApp();
    sincronizar();
  } catch (erro) {
    app.mostrarLogin({ email, erro: erro.message, detalhe: erro.detalhe });
  }
}

async function sairDaConta() {
  const s = situacaoSincronizacao();
  if (s.pendentes && s.online) await sincronizar();
  const depois = situacaoSincronizacao();
  const aviso = depois.pendentes
    ? `Ainda há ${depois.pendentes} mudança(s) que não subiram para a nuvem. Se sair agora, elas se perdem. Exporte um backup antes. Sair mesmo assim?`
    : 'Sair da conta? Os dados saem deste aparelho, mas continuam guardados na nuvem.';
  if (!window.confirm(aviso)) return;
  await sair();
  await apagarDadosLocais();
  atualizarEstado({ caixa: [], conexoes: [], email: null });
  app.mostrarLogin({ mensagem: 'Você saiu da conta.' });
}

// ---------------------------------------------------------------------------
// AVA e Lyceum
// ---------------------------------------------------------------------------

async function conectarServico(form, servico) {
  const botao = form.querySelector('[type="submit"]');
  const saida = document.getElementById(`resultado-${servico}`);
  const matricula = form.elements.matricula.value.trim();
  const senha = form.elements.senha.value;
  const renderResultado = servico === 'ava' ? renderResultadoAva : renderResultadoLyceum;

  if (!matricula || !senha) {
    saida.innerHTML = renderResultado({ ok: false, erro: 'Preencha a matrícula e a senha.' });
    return;
  }

  botao.disabled = true;
  saida.innerHTML = renderCarregando(servico === 'ava' ? 'Falando com o AVA… isso leva alguns segundos.' : 'Falando com o Lyceum… isso leva alguns segundos.');
  let resultado;
  try {
    resultado = await ocupado(() => (servico === 'ava' ? conectarAva(matricula, senha) : conectarLyceum(matricula, senha)));
  } finally {
    // A senha não fica na tela depois da tentativa.
    form.elements.senha.value = '';
    botao.disabled = false;
  }

  if (resultado.ok) {
    await sincronizar(); // traz a nova situação da conexão
    app.renderizar();
    sincronizarFaculdade({ forcar: true }); // primeira leitura das disciplinas, notas e prazos
  }
  const novaSaida = document.getElementById(`resultado-${servico}`);
  novaSaida.innerHTML = renderResultado(resultado);
  novaSaida.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function desconectarServico(servico) {
  const nome = servico === 'ava' ? 'o AVA' : 'o Lyceum';
  const extra = servico === 'lyceum' ? ' A senha guardada é apagada.' : ' O acesso guardado é apagado.';
  if (!window.confirm(`Desconectar ${nome}?${extra} Para voltar, é só conectar de novo.`)) return;
  const resultado = await ocupado(() => desconectar(servico));
  if (!resultado.ok) {
    avisoCurto(resultado.erro || 'Não foi possível desconectar agora.');
    return;
  }
  await sincronizar();
  app.renderizar();
  avisoCurto(`${servico === 'ava' ? 'AVA' : 'Lyceum'} desconectado.`);
}

// ---------------------------------------------------------------------------
// Caixa de entrada e backup
// ---------------------------------------------------------------------------

async function guardarIdeia(form) {
  const texto = form.elements.texto.value.trim();
  if (!texto) {
    form.elements.texto.focus();
    return;
  }
  await salvar('caixa_entrada', { texto });
  form.reset();
  document.getElementById('folha-criar').close();
  avisoCurto('Ideia guardada na caixa de entrada.');
}

async function marcarEntradaFeita(id) {
  const item = await obter('caixa_entrada', id);
  if (item) await salvar('caixa_entrada', { ...item, processado_em: new Date().toISOString() });
}

async function fazerBackup() {
  const saida = document.getElementById('backup-resultado');
  try {
    const total = await exportarBackup();
    saida.innerHTML = `<p class="ava-status">Backup exportado com ${total} ${total === 1 ? 'registro' : 'registros'}.</p>`;
  } catch {
    saida.innerHTML = '<div class="ava-alerta" role="alert">Não foi possível exportar o backup.</div>';
  }
}

async function restaurarBackup(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  const saida = document.getElementById('backup-resultado');
  if (!window.confirm('Importar este backup? Ele se junta aos dados atuais (o que tiver o mesmo registro é substituído pelo do backup).')) return;
  try {
    const total = await importarBackup(arquivo);
    saida.innerHTML = `<p class="ava-status">Backup importado: ${total} ${total === 1 ? 'registro' : 'registros'}. Sincronizando com a nuvem…</p>`;
  } catch (erro) {
    saida.innerHTML = `<div class="ava-alerta" role="alert">${esc(erro.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Faculdade: faltas, calculadora e juntar disciplinas
// ---------------------------------------------------------------------------

async function mudarFaltasManuais(id, delta) {
  const freq = await obter('frequencias', id);
  if (!freq) return;
  await salvar('frequencias', { ...freq, faltas_manuais: Math.max(0, (Number(freq.faltas_manuais) || 0) + delta) });
  if (delta > 0) avisoCurto('Falta marcada. Ela some sozinha quando o Lyceum registrar.');
}

let tempoCalculadora = null;
async function aoMudarCalculadora(form) {
  const disciplina = obterEstado().disciplinas.find((d) => d.id === form.dataset.id);
  if (!disciplina) return;
  const meta = Number(String(form.elements.meta.value).replace(',', '.'));
  const pesos = {};
  form.querySelectorAll('input[name="peso"]').forEach((campo) => {
    const valor = Number(String(campo.value).replace(',', '.'));
    pesos[campo.dataset.chave] = Number.isFinite(valor) && valor >= 0 ? valor : 1;
  });
  disciplina.pesos = { meta: Number.isFinite(meta) && meta > 0 ? meta : 7, pesos };
  atualizarResultadoCalculadora(obterEstado(), disciplina);
  clearTimeout(tempoCalculadora);
  tempoCalculadora = setTimeout(() => salvar('disciplinas', { ...disciplina }), 800);
}

async function juntarDisciplinas(form) {
  const estado = obterEstado();
  const esta = estado.disciplinas.find((d) => d.id === form.dataset.id);
  const outra = estado.disciplinas.find((d) => d.id === form.elements.outra.value);
  if (!esta || !outra) return;
  if (!window.confirm(`Juntar "${esta.nome}" com "${outra.nome}"? Tudo das duas passa a aparecer em uma só.`)) return;

  // Fica a que tem o AVA (materiais e prazos); a outra empresta o que vem do Lyceum.
  const [fica, sai] = esta.ava_course_id || !outra.ava_course_id ? [esta, outra] : [outra, esta];
  const juntada = {
    ...fica,
    ava_course_id: fica.ava_course_id ?? sai.ava_course_id ?? null,
    nome_ava: fica.nome_ava ?? sai.nome_ava ?? null,
    lyceum_cod_disciplina: fica.lyceum_cod_disciplina ?? sai.lyceum_cod_disciplina ?? null,
    nome_lyceum: fica.nome_lyceum ?? sai.nome_lyceum ?? null,
    ano: fica.ano ?? sai.ano ?? null,
    semestre: fica.semestre ?? sai.semestre ?? null,
    professor: fica.professor ?? sai.professor ?? null,
    turma: fica.turma ?? sai.turma ?? null,
    dados: { ...(sai.dados || {}), ...(fica.dados || {}) },
    nome: sai.nome_lyceum ? sai.nome : fica.nome,
    combinacao_manual: true,
  };
  // A que sai perde os códigos antes (senão o banco acusa duplicidade) e vai para a lixeira.
  await salvar('disciplinas', { ...sai, ava_course_id: null, lyceum_cod_disciplina: null, excluido_em: new Date().toISOString() });
  await salvar('disciplinas', juntada);
  for (const tabela of ['eventos', 'materiais', 'notas_ava', 'notas_lyceum', 'frequencias', 'avisos', 'cadernos']) {
    for (const linha of (await listar(tabela)).filter((l) => l.disciplina_id === sai.id)) {
      await salvar(tabela, { ...linha, disciplina_id: fica.id });
    }
  }
  location.hash = `#faculdade/${fica.id}`;
  avisoCurto('Disciplinas juntadas.');
}

// A Carol escolhe quais disciplinas do AVA são deste semestre (vale para as próximas sincronizações).
async function escolherCursoAva(cursoId, ativo) {
  const id = Number(cursoId);
  const configs = await listar('config');
  const atual = configs.find((c) => c.chave === 'ava_cursos');
  const valor = { ativos: [], arquivados: [], ...(atual?.valor || {}) };
  valor.ativos = valor.ativos.filter((x) => x !== id);
  valor.arquivados = valor.arquivados.filter((x) => x !== id);
  (ativo ? valor.ativos : valor.arquivados).push(id);
  await salvar('config', { ...(atual || {}), chave: 'ava_cursos', valor });

  // Na tela já muda na hora; a próxima sincronização traz as atividades e os materiais.
  const disciplina = obterEstado().disciplinas.find((d) => Number(d.ava_course_id) === id && !d.excluido_em);
  if (disciplina) await salvar('disciplinas', { ...disciplina, arquivada: !ativo });
  if (!ativo) location.hash = '#faculdade';
  avisoCurto(ativo ? 'Disciplina trazida para este semestre. Buscando as atividades…' : 'Disciplina escondida.');
  if (ativo) {
    await sincronizar();
    sincronizarFaculdade({ forcar: true });
  }
}

// ---------------------------------------------------------------------------

export function ligarEventos(funcoesDoApp) {
  app = funcoesDoApp;
  ligarCalendario({ renderizar: () => app.renderizar(), avisoCurto });
  ligarAvisos({ avisoCurto });
  ligarInicio({ renderizar: () => app.renderizar(), avisoCurto });
  const folhaMais = document.getElementById('folha-mais');
  const folhaCriar = document.getElementById('folha-criar');

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-tema-opcao], [data-texto-opcao], [data-acao], a[href^="#"]');
    if (!alvo || alvo.matches('input[type="file"]')) return;

    if (alvo.dataset.temaOpcao) {
      definirTema(alvo.dataset.temaOpcao);
      return;
    }
    if (alvo.dataset.textoOpcao) {
      definirTamanhoTexto(alvo.dataset.textoOpcao);
      return;
    }

    switch (alvo.dataset.acao) {
      case 'abrir-mais':
        folhaMais.showModal();
        return;
      case 'fechar-mais':
        folhaMais.close();
        return;
      case 'abrir-criar':
        document.getElementById('folha-criar-conteudo').innerHTML = renderFolhaCriar();
        folhaCriar.showModal();
        folhaCriar.querySelector('textarea')?.focus();
        return;
      case 'fechar-criar':
        folhaCriar.close();
        return;
      case 'sincronizar':
        sincronizar();
        return;
      case 'exportar-backup':
        fazerBackup();
        return;
      case 'sair':
        sairDaConta();
        return;
      case 'mostrar-reconectar': {
        const bloco = document.getElementById(`reconectar-${alvo.dataset.servico}`);
        bloco.hidden = !bloco.hidden;
        if (!bloco.hidden) bloco.querySelector('input')?.focus();
        return;
      }
      case 'desconectar':
        desconectarServico(alvo.dataset.servico);
        return;
      case 'entrada-feita':
        marcarEntradaFeita(alvo.dataset.id);
        return;
      case 'sincronizar-faculdade':
        sincronizarFaculdade({ forcar: true }).then((r) => {
          if (r.estado === 'ok') avisoCurto('Faculdade atualizada.');
        });
        return;
      case 'ava-curso-ativo':
        escolherCursoAva(alvo.dataset.curso, true);
        return;
      case 'ava-curso-esconder':
        if (window.confirm('Esconder esta disciplina? Ela sai da Faculdade e do Início. Dá para trazer de volta em "Disciplinas do AVA fora deste semestre".')) {
          escolherCursoAva(alvo.dataset.curso, false);
        }
        return;
      case 'faltei-hoje':
        mudarFaltasManuais(alvo.dataset.id, 1);
        return;
      case 'desfazer-falta':
        mudarFaltasManuais(alvo.dataset.id, -1);
        return;
      default:
        if (alvo.dataset.acao && (cliqueCalendario(alvo) || cliqueAvisos(alvo) || cliqueInicio(alvo))) return;
    }

    // Um link escolhido dentro da folha "Mais" fecha a folha.
    if (folhaMais.open && folhaMais.contains(alvo)) folhaMais.close();
  });

  // Tocar fora da folha (no véu) também fecha.
  for (const folha of [folhaMais, folhaCriar, document.getElementById('folha-evento')]) {
    folha.addEventListener('click', (evento) => {
      if (evento.target === folha) folha.close();
    });
  }

  document.addEventListener('change', (evento) => {
    if (evento.target.matches('[data-acao="importar-backup"]')) restaurarBackup(evento.target);
    else if (!mudancaInicio(evento.target) && !mudancaAvisos(evento.target)) mudancaCalendario(evento.target);
  });

  document.addEventListener('input', (evento) => {
    const form = evento.target.closest('[data-form="calculadora"]');
    if (form) aoMudarCalculadora(form);
    else if (evento.target.type !== 'checkbox') mudancaCalendario(evento.target);
  });

  document.addEventListener('submit', (evento) => {
    const form = evento.target.closest('[data-form]');
    if (!form) return;
    evento.preventDefault();
    if (enviarCalendario(form) || enviarAvisos(form) || enviarInicio(form)) return;
    switch (form.dataset.form) {
      case 'login':
        entrar(form);
        break;
      case 'caixa-entrada':
        guardarIdeia(form);
        break;
      case 'conectar-ava':
        conectarServico(form, 'ava');
        break;
      case 'conectar-lyceum':
        conectarServico(form, 'lyceum');
        break;
      case 'juntar-disciplina':
        juntarDisciplinas(form);
        break;
      case 'calculadora':
        break;
    }
  });
}
