// Tela Configurações: conta, sincronização e backup, aparência, AVA e Lyceum.

import { cabecalho } from './componentes.js';
import { icone } from './icones.js';
import { OPCOES_TEMA, lerPreferenciaTema } from './tema.js';
import { OPCOES_TEXTO, lerTamanhoTexto, OPCOES_VIDRO, lerVidro } from './preferencias.js';
import { esc, haQuantoTempo } from './utilidades.js';
import { cardAvisos, cardPlanoPrefs } from './views-avisos.js';
import { cardConfigDemandas } from './views-demandas.js';
import { cardWidgets } from './views-widgets.js';
import { cardProtegidos } from './views-protegidos.js';
import { chaveDoTrello } from './nuvem.js';

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function textoSituacao(s) {
  if (!s.nuvem) return 'Modo local: a nuvem ainda não foi configurada. Tudo fica salvo neste aparelho.';
  if (!s.logada) return 'Entre no app para sincronizar.';
  if (!s.online || s.estado === 'offline') return 'Sem internet. Salvando neste aparelho; sincroniza quando a conexão voltar.';
  if (s.estado === 'sincronizando') return 'Sincronizando…';
  if (s.estado === 'erro') return `A última sincronização falhou. ${s.erro || ''}`.trim();
  if (s.estado === 'aviso') return `Sincronizado, mas uma parte ficou esperando: ${s.erro || ''}`.trim();
  if (s.ultima) return `Sincronizado ${haQuantoTempo(new Date(s.ultima).getTime())}.`;
  return 'Ainda não sincronizado.';
}

function cardConta(estado) {
  const s = estado.sinc;
  return `
    <section class="card" aria-labelledby="config-conta">
      <h2 class="card-titulo" id="config-conta">Conta</h2>
      ${s.nuvem && estado.email
        ? `<p class="texto-suave">Você entrou como <strong>${esc(estado.email)}</strong>.</p>
           <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="sair">Sair da conta</button></div>`
        : `<p class="texto-suave">${s.nuvem ? 'Você não entrou na conta.' : 'O Supabase ainda não foi configurado na Netlify. O app funciona só neste aparelho por enquanto.'}</p>`}
    </section>`;
}

function cardSincronizacao(estado) {
  const s = estado.sinc;
  return `
    <section class="card" aria-labelledby="config-sinc">
      <h2 class="card-titulo" id="config-sinc">Sincronização e backup</h2>
      <p class="texto-suave" data-situacao-sinc>${esc(textoSituacao(s))}</p>
      ${s.pendentes ? `<p class="texto-suave">${s.pendentes} ${s.pendentes === 1 ? 'mudança esperando' : 'mudanças esperando'} para subir.</p>` : ''}
      <div class="acoes">
        ${s.nuvem && s.logada ? '<button class="botao botao-primario" type="button" data-acao="sincronizar">Sincronizar agora</button>' : ''}
        <button class="botao botao-secundario" type="button" data-acao="exportar-backup">Exportar backup</button>
        <label class="botao botao-secundario">
          Importar backup
          <input class="visualmente-oculto" type="file" accept="application/json,.json,.gz,application/gzip" data-acao="importar-backup">
        </label>
      </div>
      <p class="campo-ajuda">O backup é um arquivo com tudo o que está no app (sem senhas nem tokens).</p>
      <div id="backup-resultado" aria-live="polite"></div>
      ${s.nuvem && s.logada ? `
        <h3 class="ava-subtitulo">Cópias automáticas na nuvem</h3>
        <p class="campo-ajuda">Toda madrugada a Bússola guarda uma cópia de tudo no seu espaço do Supabase (se algo mudou). Ficam as dos últimos 7 dias e uma por semana por 2 meses.</p>
        <div id="backup-copias">${listaCopias(estado)}</div>
        <div class="acoes">
          ${estado.copiasBackup ? '' : '<button class="botao botao-secundario" type="button" data-acao="backup-ver">Ver as cópias</button>'}
          <button class="botao botao-secundario" type="button" data-acao="backup-agora"${estado.fazendoBackup ? ' disabled aria-busy="true"' : ''}>${estado.fazendoBackup ? 'Copiando…' : 'Fazer uma cópia agora'}</button>
        </div>` : ''}
    </section>`;
}

const diaCopia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const tamanho = (b) => (!b ? '' : b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`);

function listaCopias(estado) {
  const copias = estado.copiasBackup;
  if (!copias) return '';
  if (!copias.length) return '<p class="texto-suave">Ainda não há cópias. A primeira sai nesta madrugada, ou toque em "Fazer uma cópia agora".</p>';
  return `<ul class="lista-simples backup-copias">${copias.map((c) => `
    <li>
      <span><strong>${esc(diaCopia.format(new Date(`${c.dia}T12:00:00Z`)).replace(/\./g, ''))}</strong>${c.tamanho ? ` <small class="campo-ajuda">${esc(tamanho(c.tamanho))}</small>` : ''}</span>
      <span class="acoes">
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="backup-baixar" data-caminho="${esc(c.caminho)}" data-nome="${esc(c.nome)}">Baixar</button>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="backup-restaurar" data-caminho="${esc(c.caminho)}" data-dia="${esc(c.dia)}">Restaurar</button>
      </span>
    </li>`).join('')}</ul>`;
}

// Restaurar uma cópia: o jeito seguro (só o que sumiu) vem primeiro.
export function folhaRestaurar(dia) {
  const quando = diaCopia.format(new Date(`${dia}T12:00:00Z`)).replace(/\./g, '');
  return `
    <p class="texto-suave">Cópia de <strong>${esc(quando)}</strong>. Como você quer restaurar?</p>
    <div class="dem-escolhas">
      <button class="botao botao-primario" type="button" data-acao="backup-restaurar-confirmar" data-modo="faltando">Só o que sumiu</button>
      <p class="campo-ajuda">Volta o que foi apagado ou não está mais no app. O que você mudou depois da cópia fica como está. Recomendado.</p>
      <button class="botao botao-secundario" type="button" data-acao="backup-restaurar-confirmar" data-modo="tudo">Tudo como estava na cópia</button>
      <p class="campo-ajuda">Cada registro volta exatamente como estava nesse dia. O que mudou depois se perde.</p>
    </div>`;
}

function cardAparencia() {
  const tema = lerPreferenciaTema();
  const texto = lerTamanhoTexto();
  const opcoesTema = OPCOES_TEMA.map((o) => `
    <button class="opcao-tema" type="button" data-tema-opcao="${o.id}" aria-pressed="${o.id === tema}">
      ${icone(o.id)}
      <span>${esc(o.rotulo)}<small>${esc(o.descricao)}</small></span>
    </button>`).join('');
  const vidro = lerVidro();
  const opcoesVidro = OPCOES_VIDRO.map((o) => `
    <button class="opcao-tema" type="button" data-vidro-opcao="${o.id}" aria-pressed="${o.id === vidro}">
      <span>${esc(o.rotulo)}<small>${esc(o.descricao)}</small></span>
    </button>`).join('');
  const opcoesTexto = OPCOES_TEXTO.map((o) => `
    <button class="opcao-tema opcao-texto opcao-texto--${o.id}" type="button" data-texto-opcao="${o.id}" aria-pressed="${o.id === texto}">
      <span aria-hidden="true">Aa</span><span>${esc(o.rotulo)}</span>
    </button>`).join('');

  return `
    <section class="card" aria-labelledby="config-aparencia">
      <h2 class="card-titulo" id="config-aparencia">Aparência</h2>
      <p class="texto-suave">As escolhas ficam salvas neste aparelho.</p>
      <h3 class="ava-subtitulo">Tema</h3>
      <div class="opcoes-tema">${opcoesTema}</div>
      <h3 class="ava-subtitulo">Tamanho do texto</h3>
      <div class="opcoes-tema">${opcoesTexto}</div>
      <h3 class="ava-subtitulo">Vidro</h3>
      <div class="opcoes-tema">${opcoesVidro}</div>
      <p class="campo-ajuda">As barras e as folhas deixam ver, desfocado, o que passa por trás. Se o sistema estiver com "reduzir transparência", fica desligado de qualquer jeito.</p>
    </section>`;
}

function formularioConexao(servico, rotuloSenha) {
  return `
    <form class="formulario" data-form="conectar-${servico}" novalidate>
      <label class="campo">
        <span class="campo-rotulo">Matrícula</span>
        <input name="matricula" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" required>
      </label>
      <label class="campo">
        <span class="campo-rotulo">${esc(rotuloSenha)}</span>
        <input name="senha" type="password" autocomplete="current-password" required>
      </label>
      <div><button class="botao botao-primario" type="submit">Conectar</button></div>
    </form>`;
}

function cardServico(estado, { servico, titulo, rotuloSenha, explicacao, resumo }) {
  const conexao = estado.conexoes.find((c) => c.servico === servico);
  const conectado = conexao?.status === 'conectado';
  const pedeReconectar = conexao?.status === 'reconectar' || conexao?.status === 'erro';
  const semConta = !estado.sinc.nuvem || !estado.email;

  let corpo;
  if (semConta) {
    corpo = '<p class="texto-suave">Entre na sua conta do Hub para conectar.</p>';
  } else if (conectado) {
    corpo = `
      <div class="ava-sucesso">
        <strong>✓ Conectado${conexao.conectado_em ? ` desde ${dataCurta.format(new Date(conexao.conectado_em))}` : ''}</strong>
        ${resumo(conexao.detalhe || {})}
        <span>${conexao.ultima_sincronizacao ? `Última sincronização ${esc(haQuantoTempo(new Date(conexao.ultima_sincronizacao).getTime()))}` : 'Ainda não sincronizado'}${conexao.detalhe?.sincronizacao?.bloqueados?.length ? ` · ${conexao.detalhe.sincronizacao.bloqueados.length} item(ns) indisponível(is)` : ''}</span>
      </div>
      <div class="acoes">
        <button class="botao botao-secundario" type="button" data-acao="mostrar-reconectar" data-servico="${servico}">Reconectar</button>
        <button class="botao botao-secundario" type="button" data-acao="desconectar" data-servico="${servico}">Desconectar</button>
      </div>
      <div class="reconectar" id="reconectar-${servico}" hidden>${formularioConexao(servico, rotuloSenha)}</div>`;
  } else {
    corpo = `
      ${pedeReconectar ? `<div class="ava-alerta" role="alert">${esc(conexao.detalhe?.mensagem || 'O acesso parou de funcionar. Conecte de novo.')}</div>` : ''}
      <p class="texto-suave">${esc(explicacao)}</p>
      ${formularioConexao(servico, rotuloSenha)}`;
  }

  return `
    <section class="card" aria-labelledby="config-${servico}">
      <h2 class="card-titulo" id="config-${servico}">${esc(titulo)}</h2>
      ${corpo}
      <div class="ava-resultado" id="resultado-${servico}" aria-live="polite"></div>
    </section>`;
}

// O que a última sincronização trouxe do AVA (ajuda a ver se algo ficou de fora).
function resumoAva(d) {
  const geral = d.sincronizacao?.contagens || {};
  const cursos = d.cursosContagens || {};
  const partes = [];
  if (geral.cursosNoAva !== undefined) partes.push(`${geral.disciplinas || 0} disciplinas em andamento (de ${geral.cursosNoAva} no AVA)`);
  if (geral.eventos !== undefined) partes.push(`${geral.eventos} prazos e eventos`);
  if (cursos.materiais !== undefined) partes.push(`${cursos.materiais} materiais`, `${cursos.notas || 0} notas`, `${cursos.avisos || 0} avisos`);
  const diagnostico = geral.diagnostico || [];
  const MODOS = { andamento: 'o próprio AVA', reserva: 'datas e último acesso', todas: 'todas (o AVA não indicou)' };
  const blocoDiagnostico = diagnostico.length ? `
    <details class="detalhes"><summary>Diagnóstico das disciplinas do AVA</summary>
      <p class="campo-ajuda">Em andamento decidido por: ${esc(MODOS[geral.modo] || geral.modo || '—')}.</p>
      <ul class="vazio-lista">${diagnostico.map((c) => `<li>${c.ativo ? '✓' : '✕'} ${esc(c.nome)} — início ${esc(c.inicio || '—')}, fim ${esc(c.fim || '—')}, último acesso ${esc(c.ultimoAcesso || '—')}${c.emAndamento ? ', AVA: em andamento' : ''}${c.visivel ? '' : ', oculta'}</li>`).join('')}</ul>
    </details>` : '';
  const bloqueados = [...(d.sincronizacao?.bloqueados || []), ...(d.cursosBloqueados || [])];
  return `
    <span>${esc(d.site?.nome || 'AVA')}${d.site?.versao ? ` · Moodle ${esc(d.site.versao)}` : ''}</span>
    ${partes.length ? `<span>Última leitura: ${esc(partes.join(' · '))}</span>` : ''}
    ${bloqueados.length ? `<details class="detalhes"><summary>${bloqueados.length} ${bloqueados.length === 1 ? 'item não veio' : 'itens não vieram'}</summary>
      <ul class="vazio-lista">${bloqueados.map((b) => `<li><code>${esc(b.metodo)}</code>: ${esc(b.motivo)}</li>`).join('')}</ul></details>` : ''}
    ${blocoDiagnostico}`;
}

export function renderConfiguracoes(estado) {
  return `
    ${cabecalho('Configurações', 'Conta, sincronização, avisos e conexões')}
    <div class="pilha">
      ${cardConta(estado)}
      ${cardSincronizacao(estado)}
      ${cardAparencia()}
      ${cardAvisos(estado)}
      ${cardPlanoPrefs(estado)}
      ${cardProtegidos(estado)}
      ${cardServico(estado, {
        servico: 'ava',
        titulo: 'AVA (Moodle)',
        rotuloSenha: 'Senha do AVA',
        explicacao: 'Digite a matrícula e a senha uma vez. O app guarda só o acesso do app do Moodle, criptografado, e descarta a senha. Daí em diante o AVA sincroniza sozinho.',
        resumo: resumoAva,
      })}
      ${cardServico(estado, {
        servico: 'lyceum',
        titulo: 'Lyceum (notas e frequência)',
        rotuloSenha: 'Senha do Lyceum',
        explicacao: 'Digite a matrícula e a senha uma vez. A senha fica guardada criptografada (só as funções do app conseguem abrir) para o Lyceum sincronizar sozinho. Você pode desconectar quando quiser.',
        resumo: (d) => `<span>${esc([d.curso, d.turno, d.serie].filter(Boolean).join(' · ') || 'Portal do aluno')}</span>`,
      })}
      ${cardConfigDemandas(estado, chaveDoTrello())}
      ${cardWidgets(estado)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Resultado da conexão com o AVA (mesmo relatório do teste da Etapa 3)
// ---------------------------------------------------------------------------

function itemMetodo(m) {
  return `
    <li class="metodo ${m.liberado ? 'metodo--ok' : 'metodo--bloqueado'}">
      <span class="metodo-marca" aria-hidden="true">${m.liberado ? '✓' : '✕'}</span>
      <span class="metodo-texto">
        <span class="metodo-descricao">${esc(m.descricao)}</span>
        <code>${esc(m.nome)}</code>
      </span>
      <span class="visualmente-oculto">${m.liberado ? 'liberado' : 'bloqueado'}</span>
    </li>`;
}

function itemEtapa(e) {
  return `
    <li class="metodo ${e.ok ? 'metodo--ok' : 'metodo--bloqueado'}">
      <span class="metodo-marca" aria-hidden="true">${e.ok ? '✓' : '✕'}</span>
      <span class="metodo-texto">
        <span class="metodo-descricao">${esc(e.nome)}</span>
        <span class="metodo-detalhe">${esc(e.detalhe)}</span>
      </span>
    </li>`;
}

export function renderCarregando(texto) {
  return `<p class="ava-status">${esc(texto)}</p>`;
}

export function renderResultadoAva(r) {
  const etapas = (r.etapas || []).map(itemEtapa).join('');
  const blocoEtapas = etapas ? `<h3 class="ava-subtitulo">Passo a passo</h3><ul class="metodos">${etapas}</ul>` : '';

  if (!r.ok) {
    return `
      <div class="ava-alerta" role="alert">${esc(r.erro || 'Não deu certo desta vez.')}</div>
      ${blocoEtapas}`;
  }

  const bloqueados = r.metodos.filter((m) => !m.liberado).length;
  return `
    <div class="ava-sucesso">
      <strong>AVA conectado${r.usuaria?.nome ? `, ${esc(r.usuaria.nome)}` : ''}!</strong>
      <span>${bloqueados === 0 ? 'Tudo o que o Hub precisa está liberado.' : `${bloqueados} ${bloqueados === 1 ? 'método está bloqueado' : 'métodos estão bloqueados'}; o app segue com o resto.`}</span>
    </div>
    ${blocoEtapas}
    <details class="detalhes">
      <summary>Ver os métodos liberados</summary>
      <ul class="metodos">${r.metodos.map(itemMetodo).join('')}</ul>
    </details>`;
}

export function renderResultadoLyceum(r) {
  if (!r.ok) return `<div class="ava-alerta" role="alert">${esc(r.erro || 'Não deu certo desta vez.')}</div>`;
  const curso = [r.curso?.curso, r.curso?.turno, r.curso?.serie].filter(Boolean).join(' · ');
  return `
    <div class="ava-sucesso">
      <strong>Lyceum conectado!</strong>
      ${curso ? `<span>${esc(curso)}</span>` : ''}
      <span>A senha ficou guardada criptografada. A leitura de notas e faltas chega na próxima etapa.</span>
    </div>`;
}
