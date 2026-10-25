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
  { id: 'aula', nome: 'Aulas' },
  { id: 'feriado', nome: 'Feriados' },
  { id: 'pessoal', nome: 'Eventos pessoais' },
];

const marcar = (nome, valor, rotulo, marcado) => `
  <label class="campo-marcar">
    <input type="checkbox" name="${nome}" value="${esc(valor)}"${marcado ? ' checked' : ''}>
    <span>${esc(rotulo)}</span>
  </label>`;

export function cardAvisos(estado) {
  const cfg = configDeAvisos(estado);
  return `
    <section class="card" aria-labelledby="config-avisos">
      <h2 class="card-titulo" id="config-avisos">Avisos de prazo</h2>
      <p class="texto-suave">Os avisos chegam no aparelho mesmo com o app fechado. Ative em cada aparelho onde quiser receber (tablet e celular).</p>
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
      </form>
    </section>`;
}

export function situacaoAvisosHtml(s) {
  const extra = s.instalado ? '' : '<p class="campo-ajuda">Dica: com o app instalado na tela inicial, os avisos chegam com mais garantia.</p>';
  switch (s.estado) {
    case 'sem-suporte':
      return '<div class="ava-alerta" role="note">Este navegador não recebe avisos. No tablet e no celular, use o app instalado pelo Chrome ou pelo Samsung Internet.</div>';
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
