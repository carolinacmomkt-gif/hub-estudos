// Configurações: avisos de prazo neste aparelho e preferências do plano de estudo.

import { esc } from './utilidades.js';
import { configDeAvisos } from './avisos.js';
import { preferenciasPlano, OPCOES_DIAS, OPCOES_MINUTOS } from './plano-estudo.js';

const MARCOS = [
  { id: '3d', nome: '3 dias antes' },
  { id: '1d', nome: '1 dia antes' },
  { id: 'dia', nome: 'No dia' },
];
const TIPOS = [
  { id: 'prova', nome: 'Provas' },
  { id: 'trabalho', nome: 'Trabalhos' },
  { id: 'atividade', nome: 'Atividades' },
  { id: 'revisao', nome: 'Sessões de revisão' },
  { id: 'youtube', nome: 'Gravar e publicar vídeos' },
  { id: 'substack', nome: 'Publicar no Substack' },
  { id: 'aula', nome: 'Aulas' },
  { id: 'feriado', nome: 'Feriados' },
  { id: 'pessoal', nome: 'Eventos pessoais' },
];

const marcar = (nome, valor, rotulo, marcado) => `
  <label class="campo-marcar">
    <input type="checkbox" name="${nome}" value="${esc(valor)}"${marcado ? ' checked' : ''}>
    <span>${esc(rotulo)}</span>
  </label>`;

const linhaVida = (id, nome, ajuda, v) => `
  <div class="aviso-vida">
    <label class="campo-marcar"><input type="checkbox" name="vida-${id}" value="1"${v.ativo ? ' checked' : ''}><span>${esc(nome)}<small class="campo-ajuda">${esc(ajuda)}</small></span></label>
    <label class="visualmente-oculto" for="vida-hora-${id}">Horário: ${esc(nome)}</label>
    <input id="vida-hora-${id}" name="vida-hora-${id}" type="time" value="${esc(v.hora)}">
  </div>`;

// iPhone e iPad: avisos só no app instalado pelo Safari (iOS 16.4 ou mais novo).
const ehIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instaladoNoIos = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

export function cardAvisos(estado) {
  const cfg = configDeAvisos(estado);
  return `
    <section class="card" aria-labelledby="config-avisos">
      <h2 class="card-titulo" id="config-avisos">Avisos no aparelho</h2>
      <p class="texto-suave">Os avisos chegam mesmo com o app fechado. Ative em cada aparelho onde quiser receber (celular e tablet).</p>
      <div id="avisos-situacao" aria-live="polite"><p class="ava-status">Verificando este aparelho…</p></div>
      <form class="formulario" data-form="avisos" novalidate>
        <label class="campo campo-curto">
          <span class="campo-rotulo">Horário dos avisos</span>
          <input name="hora" type="time" value="${esc(cfg.hora)}" required>
          <span class="campo-ajuda">No dia de uma prova cedo, o aviso sai pelo menos 2h antes (nunca antes das 6h).</span>
        </label>
        <fieldset class="grupo-marcar">
          <legend class="campo-rotulo">Quando avisar</legend>
          ${MARCOS.map((m) => marcar('marco', m.id, m.nome, cfg.marcos[m.id])).join('')}
        </fieldset>
        <fieldset class="grupo-marcar grupo-marcar-linha">
          <legend class="campo-rotulo">Avisar sobre</legend>
          ${TIPOS.map((t) => marcar('tipo', t.id, t.nome, cfg.tipos[t.id])).join('')}
        </fieldset>
        <fieldset class="grupo-marcar avisos-vida">
          <legend class="campo-rotulo">Do dia a dia</legend>
          ${linhaVida('manha', 'Resumo da manhã', 'Tarefas, provas, contas e hábitos do dia', cfg.vida.manha)}
          ${linhaVida('contas', 'Contas do dia', 'Contas fixas e faturas que vencem hoje', cfg.vida.contas)}
          ${linhaVida('habitos', 'Hábitos que faltam', 'Só se ainda faltar algum no dia', cfg.vida.habitos)}
          <div class="aviso-vida">
            ${marcar('silencio-ativo', '1', 'Horário de silêncio', cfg.vida.silencio.ativo)}
            <span class="aviso-vida-horas">
              <label class="visualmente-oculto" for="silencio-de">Silêncio a partir de</label><input id="silencio-de" name="silencio-de" type="time" value="${esc(cfg.vida.silencio.de)}">
              <span aria-hidden="true">às</span>
              <label class="visualmente-oculto" for="silencio-ate">Silêncio até</label><input id="silencio-ate" name="silencio-ate" type="time" value="${esc(cfg.vida.silencio.ate)}">
            </span>
          </div>
        </fieldset>
        <fieldset class="grupo-marcar">
          <legend class="campo-rotulo">Resumo da semana</legend>
          ${marcar('resumo-ativo', '1', 'Mandar um resumo da semana (foco, questões, leituras e os prazos da semana seguinte)', cfg.resumo.ativo)}
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Quando</span>
              <select name="resumo-dia"><option value="0"${Number(cfg.resumo.dia) === 0 ? ' selected' : ''}>Domingo</option><option value="1"${Number(cfg.resumo.dia) === 1 ? ' selected' : ''}>Segunda de manhã</option></select></label>
            <label class="campo"><span class="campo-rotulo">Horário</span>
              <input name="resumo-hora" type="time" value="${esc(cfg.resumo.hora)}"></label>
          </div>
          <a class="card-link" href="#resumo">Ver o resumo desta semana</a>
        </fieldset>
      </form>
    </section>`;
}

export function situacaoAvisosHtml(s) {
  const extra = s.instalado ? '' : '<p class="campo-ajuda">Dica: com o app instalado na tela inicial, os avisos chegam com mais garantia.</p>';
  switch (s.estado) {
    case 'sem-suporte':
      if (ehIos() && !instaladoNoIos()) {
        return `<div class="ava-alerta" role="note"><strong>No iPhone, os avisos funcionam com o Bússola na Tela de Início:</strong>
          <ol class="passos-ios"><li>Abra este site no <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta).</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Abra o Bússola pelo ícone novo e volte aqui para ativar.</li></ol>
          <span class="campo-ajuda">Precisa do iOS 16.4 ou mais novo.</span></div>`;
      }
      return '<div class="ava-alerta" role="note">Este navegador não recebe avisos. No celular e no tablet, use o app instalado na tela de início (Safari no iPhone; Chrome ou Samsung Internet no Android).</div>';
    case 'sem-chave':
      return '<div class="ava-alerta" role="note">Os avisos ainda não foram configurados na Netlify (faltam as variáveis VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).</div>';
    case 'bloqueado':
      return '<div class="ava-alerta" role="note">As notificações do Hub estão bloqueadas neste aparelho. Libere em Configurações do aparelho → Notificações (ou no cadeado ao lado do endereço) e volte aqui.</div>';
    case 'ativo':
      return `
        <p class="ava-sucesso"><strong>Avisos ligados neste aparelho.</strong></p>
        <div class="acoes">
          <button class="botao botao-secundario" type="button" data-acao="avisos-testar">Mandar um aviso de teste</button>
          <button class="botao botao-secundario" type="button" data-acao="avisos-desativar">Desligar neste aparelho</button>
        </div>`;
    default:
      return `
        <div class="acoes"><button class="botao botao-primario" type="button" data-acao="avisos-ativar">Ativar avisos neste aparelho</button></div>
        ${extra}`;
  }
}

export function cardPlanoPrefs(estado) {
  const prefs = preferenciasPlano(estado);
  return `
    <section class="card" aria-labelledby="config-plano">
      <h2 class="card-titulo" id="config-plano">Plano de estudo para provas</h2>
      <p class="texto-suave">Quando aparece uma prova, o app sugere sessões de revisão nos dias antes dela. Você confere e aceita no Início ou no Calendário.</p>
      <form class="formulario" data-form="plano-prefs" novalidate>
        <fieldset class="grupo-marcar grupo-marcar-linha">
          <legend class="campo-rotulo">Revisar quantos dias antes</legend>
          ${OPCOES_DIAS.map((n) => marcar('dias', n, n === 1 ? 'Véspera' : `${n} dias`, prefs.dias.includes(n))).join('')}
        </fieldset>
        <div class="cal-form-linha">
          <label class="campo">
            <span class="campo-rotulo">Horário das sessões</span>
            <input name="hora" type="time" value="${esc(prefs.hora)}" required>
          </label>
          <label class="campo">
            <span class="campo-rotulo">Duração</span>
            <select name="minutos">${OPCOES_MINUTOS.map((m) => `<option value="${m}"${m === prefs.minutos ? ' selected' : ''}>${m} min</option>`).join('')}</select>
          </label>
        </div>
      </form>
    </section>`;
}
