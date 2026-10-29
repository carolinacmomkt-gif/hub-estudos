// Telas dos blocos protegidos (Configurações) e do dia leve (Hoje).

import { esc } from './utilidades.js';
import { protegidosDe, textoDias, NOMES_DIA_CURTO, SUGESTOES_PROTEGIDOS } from './dados-protegidos.js';
import { diaLeveDe, inegociaveis, passoPequeno, versaoMinima, tarefasParaAmanha } from './dados-dialeve.js';
import { habitosDoDia, feitoNoDia } from './dados-habitos.js';
import { situacaoDasContas, mesDe } from './dados-financas.js';

// ---------------------------------------------------------------------------
// Configurações → Horas protegidas
// ---------------------------------------------------------------------------

export function cardProtegidos(estado) {
  const lista = protegidosDe(estado.config);
  const usadas = new Set(lista.map((b) => b.nome.toLowerCase()));
  const sugestoes = SUGESTOES_PROTEGIDOS.filter((s) => !usadas.has(s.nome.toLowerCase()));
  return `
    <section class="card" aria-labelledby="config-protegidos">
      <h2 class="card-titulo" id="config-protegidos">Horas protegidas</h2>
      <p class="texto-suave">Horas que nada invade: nem o organizador de demandas, nem o "Planejar meu dia", nem a IA. Se uma demanda só couber passando por cima, ela vai para "Sem espaço" com a mensagem pronta para pedir prazo. O almoço já vem do horário do seu dia.</p>
      ${lista.length ? `<ul class="protegidos">${lista.map((b) => `
        <li class="protegido">
          <span class="protegido-nome">${esc(b.emoji || '🔒')} <strong>${esc(b.nome)}</strong></span>
          <span class="campo-ajuda">${esc(textoDias(b.dias))} · ${esc(b.inicio)}–${esc(b.fim)}</span>
          <button class="botao-icone botao-icone-p" type="button" data-acao="protegido-remover" data-id="${esc(b.id)}" aria-label="Tirar ${esc(b.nome)} das horas protegidas" title="Tirar">×</button>
        </li>`).join('')}</ul>` : ''}
      ${sugestoes.length ? `<div class="acoes protegidos-sugestoes">${sugestoes.map((s) => `<button class="chip-filtro" type="button" data-acao="protegido-sugestao" data-nome="${esc(s.nome)}">${esc(s.emoji)} ${esc(s.nome)} · ${esc(s.inicio)}–${esc(s.fim)}</button>`).join('')}</div>` : ''}
      <form class="formulario protegido-form" data-form="protegido" novalidate>
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Nome</span><input name="nome" type="text" maxlength="40" placeholder="Ex.: Academia" required></label>
          <label class="campo campo-curto"><span class="campo-rotulo">Emoji</span><input name="emoji" type="text" maxlength="4" placeholder="🏋️"></label>
        </div>
        <fieldset class="campo"><legend class="campo-rotulo">Dias</legend>
          <div class="protegido-dias">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="segmentado-opcao"><input type="checkbox" name="dias" value="${d}"${d >= 1 && d <= 5 ? ' checked' : ''}><span>${esc(NOMES_DIA_CURTO[d])}</span></label>`).join('')}</div>
        </fieldset>
        <div class="cal-form-linha">
          <label class="campo"><span class="campo-rotulo">Das</span><input name="inicio" type="time" value="12:00" required></label>
          <label class="campo"><span class="campo-rotulo">Até</span><input name="fim" type="time" value="13:00" required></label>
          <button class="botao botao-secundario" type="submit">Proteger</button>
        </div>
        <p class="campo-ajuda" data-erro hidden></p>
      </form>
    </section>`;
}

// ---------------------------------------------------------------------------
// Hoje → Dia leve
// ---------------------------------------------------------------------------

export function botaoDiaLeve(ativo) {
  return ativo
    ? '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="dialeve-sair">Voltar ao dia normal</button>'
    : '<button class="botao botao-secundario botao-pequeno" type="button" data-acao="dialeve-entrar" title="Hoje estou sem energia: deixa só o que não dá para pular">Dia leve</button>';
}

export function cardDiaLeve(estado, hoje) {
  const d = diaLeveDe(estado.config);
  const contas = situacaoDasContas(estado.financas || [], mesDe(hoje), hoje).filter((x) => x.estado !== 'paga' && x.vence === hoje).map((x) => x.conta.descricao);
  const itens = inegociaveis({ tarefas: estado.tarefas, eventos: estado.eventos, contas, hoje });
  const movidas = (d.movidas || []).length;
  const passo = passoPequeno(hoje);
  const registros = estado.habitoRegistros || [];
  const habitos = habitosDoDia(estado.habitos || [], registros, hoje).lista.filter((h) => !feitoNoDia(registros, h, hoje)).slice(0, 3);
  return `
    <section class="card dialeve" aria-labelledby="dialeve-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="dialeve-titulo">🌿 Dia leve</h2>
        <button class="card-link" type="button" data-acao="dialeve-sair">Voltar ao dia normal</button>
      </div>
      <p class="texto-suave">Hoje vale o mínimo.${movidas ? ` ${movidas} ${movidas === 1 ? 'tarefa foi' : 'tarefas foram'} para amanhã;` : ''} o resto do app continua lá, só não fica te cobrando.</p>

      <h3 class="ava-subtitulo">Só o que não dá para pular</h3>
      ${itens.length ? `<ul class="dialeve-lista">${itens.map((i) => `
        <li class="dialeve-item tipo-${esc(i.tipo)}">
          <span class="dialeve-hora">${i.hora ? esc(i.hora) : i.prazo ? (i.prazo === hoje ? 'hoje' : 'amanhã') : ''}</span>
          <a href="${esc(i.rota)}">${esc(i.titulo)}</a>
          ${i.tipo === 'tarefa' && i.id ? `<button class="botao-icone botao-icone-p" type="button" data-acao="tarefa-feita" data-id="${esc(i.id)}" aria-label="Feita: ${esc(i.titulo)}" title="Feita">✓</button>` : ''}
        </li>`).join('')}</ul>` : '<p class="texto-suave">Nada com hora nem prazo hoje. Dia livre de verdade.</p>'}

      <h3 class="ava-subtitulo">Um passo pequeno</h3>
      <div class="dialeve-passo">
        <strong>${esc(passo.titulo)}</strong>
        <span class="campo-ajuda">${esc(passo.texto)}</span>
        ${passo.foco ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="foco-iniciar" data-titulo="${esc(passo.titulo)}" data-minutos="${passo.foco}">${esc(passo.acao)}</button>`
          : passo.destino ? `<a class="botao botao-secundario botao-pequeno" href="${esc(passo.destino)}">${esc(passo.acao)}</a>` : ''}
      </div>

      ${habitos.length ? `<h3 class="ava-subtitulo">Hábitos na versão mínima</h3>
      <ul class="dialeve-habitos">${habitos.map((h) => `<li><span>${esc(h.icone || '')} ${esc(h.nome)}</span><small class="campo-ajuda">${esc(versaoMinima(h))}</small><button class="botao-icone botao-icone-p" type="button" data-acao="hab-marcar" data-id="${esc(h.id)}" aria-label="Marcar ${esc(h.nome)}" title="Feito">✓</button></li>`).join('')}</ul>` : ''}
    </section>`;
}

// Quantas tarefas o dia leve mandaria para amanhã (para o aviso ao entrar).
export const quantasParaAmanha = (estado, hoje) => tarefasParaAmanha(estado.tarefas, hoje).length;
