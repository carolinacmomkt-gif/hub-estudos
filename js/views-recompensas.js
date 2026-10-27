// Aba Recompensas das Finanças (#financas/recompensas): nível, pontos, sequência, as recompensas da Carol para
// resgatar, conquistas e histórico. E o card do Hoje.

import { barraProgresso } from './componentes.js';
import { esc } from './utilidades.js';
import { situacaoGamificacao, PONTOS } from './dados-recompensas.js';

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

export function dadosGamificacao(estado) {
  return {
    tarefas: estado.tarefas, sessoes: estado.sessoesFoco, projetos: estado.projetos,
    financas: estado.financas, diario: estado.diario, config: estado.config,
    habitos: estado.habitos, habitoRegistros: estado.habitoRegistros,
  };
}

const pts = (n) => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;

function cartaoRecompensa(r, saldo) {
  const pode = saldo >= r.custo;
  return `
    <li><section class="card recompensa${pode ? ' pode' : ''}">
      <button class="recompensa-editar card-link" type="button" data-acao="rec-editar" data-id="${esc(r.id)}" aria-label="Editar ${esc(r.nome)}">Editar</button>
      <span class="recompensa-emoji" aria-hidden="true">${esc(r.emoji || '🎁')}</span>
      <strong class="recompensa-nome">${esc(r.nome)}</strong>
      <span class="campo-ajuda">${pts(r.custo)}</span>
      ${barraProgresso(Math.min(1, saldo / r.custo), `Pontos para ${r.nome}`)}
      ${pode
        ? `<button class="botao botao-primario" type="button" data-acao="rec-resgatar" data-id="${esc(r.id)}">Resgatar</button>`
        : `<span class="recompensa-falta">Faltam ${pts(r.custo - saldo)}</span>`}
    </section></li>`;
}

// Aba Recompensas dentro de Finanças (sem cabeçalho próprio).
export function abaRecompensas(estado) {
  const g = situacaoGamificacao(dadosGamificacao(estado));
  const feitas = g.conquistas.filter((c) => c.feita);
  const faltam = g.conquistas.filter((c) => !c.feita).sort((a, b) => b.fracao - a.fracao);
  return `
    <div class="rec-topo">
      <section class="card rec-nivel">
        <div class="rec-nivel-numero" aria-hidden="true"><span>nível</span><strong>${g.nivel.nivel}</strong></div>
        <div class="rec-nivel-texto">
          <p class="proximo-rotulo">${esc(g.nivel.titulo)}</p>
          ${barraProgresso(g.nivel.fracao, 'Progresso até o próximo nível')}
          <p class="campo-ajuda">${g.nivel.doNivel} de ${g.nivel.paraProximo} para o nível ${g.nivel.nivel + 1} · ${pts(g.xp)} no total</p>
        </div>
      </section>
      <section class="card rec-hoje">
        <p class="proximo-rotulo">Hoje</p>
        <p class="rec-grande">+${g.hojeXp}</p>
        <p class="campo-ajuda">${g.sequencia.dias ? `🔥 ${g.sequencia.dias} ${g.sequencia.dias === 1 ? 'dia' : 'dias'} seguidos anotando${g.sequencia.folgaUsada ? ' (com uma folga, sem problema)' : ''}` : 'Anote um gasto hoje para começar a sequência.'}</p>
      </section>
      <section class="card rec-hoje">
        <p class="proximo-rotulo">Para gastar</p>
        <p class="rec-grande">${g.saldo}</p>
        <p class="campo-ajuda">${g.podeResgatar.length ? `Já dá para: ${esc(g.podeResgatar[0].emoji || '')} ${esc(g.podeResgatar[0].nome)}` : g.proxima ? `Faltam ${pts(g.proxima.custo - g.saldo)} para ${esc(g.proxima.emoji || '')} ${esc(g.proxima.nome)}` : 'Cadastre uma recompensa.'}</p>
      </section>
    </div>
    <details class="card rec-como">
      <summary>Como ganhar pontos</summary>
      <ul class="lista-simples">
        <li><span>Cada lançamento anotado (até 5 por dia)</span><strong>+${PONTOS.lancamento}</strong></li>
        <li><span>Conta fixa paga até o vencimento</span><strong>+${PONTOS.contaEmDia}</strong></li>
        <li><span>Semana fechada dentro dos limites</span><strong>+${PONTOS.semanaNoLimite}</strong></li>
        <li><span>A cada R$ 10 guardados numa caixinha</span><strong>+${PONTOS.porDezGuardados}</strong></li>
        <li><span>Meta de caixinha batida</span><strong>+${PONTOS.caixinha}</strong></li>
        <li><span>Mês fechado no azul</span><strong>+${PONTOS.mesNoAzul}</strong></li>
      </ul>
      <p class="campo-ajuda">Os pontos vêm de cuidar bem do dinheiro, e a recompensa é uma permissão para gastar, já merecida. Nada tira pontos, e a sequência aguenta uma folga por semana.</p>
    </details>
    <section class="rec-secao">
      <div class="card-topo"><h2 class="card-titulo">Suas recompensas</h2>
        <button class="botao botao-secundario botao-pequeno" type="button" data-acao="rec-nova">Nova recompensa</button></div>
      <ul class="recompensas">${[...g.itens].sort((a, b) => a.custo - b.custo).map((r) => cartaoRecompensa(r, g.saldo)).join('')}</ul>
    </section>
    <section class="rec-secao">
      <h2 class="card-titulo">Conquistas <span class="selo">${feitas.length} de ${g.conquistas.length}</span></h2>
      <ul class="conquistas">${[...feitas, ...faltam].map((c) => `
        <li class="conquista${c.feita ? ' feita' : ''}">
          <span class="conquista-emoji" aria-hidden="true">${c.emoji}</span>
          <span class="conquista-texto"><strong>${esc(c.nome)}</strong><small class="campo-ajuda">${esc(c.texto)}</small>
            ${c.feita ? '' : `<span class="conquista-progresso">${Math.min(c.atual, c.meta)} de ${c.meta}</span>`}</span>
        </li>`).join('')}</ul>
    </section>
    ${g.resgates.length ? `<details class="card"><summary>Resgates (${g.resgates.length})</summary>
      <ul class="lista-simples">${[...g.resgates].reverse().slice(0, 20).map((r) => `<li><span>${esc(r.emoji || '🎁')} ${esc(r.nome)}</span><span class="campo-ajuda">${esc(fmtData.format(new Date(r.data)).replace('.', ''))} · −${r.pontos}</span></li>`).join('')}</ul></details>` : ''}`;
}

export function formRecompensa(r = {}) {
  return `
    <form class="formulario" data-form="rec-item" data-id="${esc(r.id || '')}" novalidate>
      <div class="cal-form-linha">
        <label class="campo"><span class="campo-rotulo">Emoji</span><input name="emoji" type="text" maxlength="4" value="${esc(r.emoji || '🎁')}"></label>
        <label class="campo"><span class="campo-rotulo">Pontos</span><input name="custo" type="number" min="10" max="10000" step="10" required value="${esc(r.custo || 100)}"></label>
      </div>
      <label class="campo"><span class="campo-rotulo">Recompensa</span><input name="nome" type="text" maxlength="60" required value="${esc(r.nome || '')}" placeholder="Ex.: Série com pipoca"></label>
      <label class="campo"><span class="campo-rotulo">Quanto costuma custar (R$, opcional)</span><input name="valor" type="number" min="0" step="1" value="${esc(r.valor || '')}"></label>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">${r.id ? 'Salvar' : 'Criar recompensa'}</button>
        ${r.id ? `<button class="botao botao-secundario botao-perigo" type="button" data-acao="rec-excluir" data-id="${esc(r.id)}">Excluir</button>` : ''}
      </div>
    </form>`;
}

export function formResgate(r, saldo, livre = null) {
  const apertado = livre !== null && r.valor > 0 && livre < r.valor;
  return `
    <form class="formulario" data-form="rec-resgate" data-id="${esc(r.id)}" novalidate>
      <p class="rec-resgate-resumo"><span aria-hidden="true">${esc(r.emoji || '🎁')}</span> ${esc(r.nome)} por <strong>${pts(r.custo)}</strong>. Ficam ${pts(saldo - r.custo)}.</p>
      ${apertado ? `<p class="ava-alerta">O seu livre para gastar este mês está em ${livre < 0 ? '−' : ''}R$ ${Math.abs(livre).toFixed(2).replace('.', ',')}. Dá para resgatar, mas talvez valha esperar o próximo mês.</p>` : ''}
      <label class="campo-marcar"><input type="checkbox" name="lancar"${r.valor ? ' checked' : ''}><span>Lançar o gasto em Finanças (Lazer)</span></label>
      <label class="campo"><span class="campo-rotulo">Valor (R$)</span><input name="valor" type="text" inputmode="decimal" value="${esc(r.valor ? String(r.valor).replace('.', ',') : '')}"></label>
      <div class="acoes"><button class="botao botao-primario" type="submit">Resgatar</button></div>
    </form>`;
}

export function cardRecompensasHoje(estado) {
  const g = situacaoGamificacao(dadosGamificacao(estado));
  const alvo = g.podeResgatar[0] || g.proxima;
  return `
    <section class="card" aria-labelledby="rec-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="rec-hoje-titulo">Nível ${g.nivel.nivel} · ${esc(g.nivel.titulo)}</h2>
        <a class="card-link" href="#financas/recompensas">Recompensas</a>
      </div>
      ${barraProgresso(g.nivel.fracao, 'Progresso até o próximo nível')}
      <ul class="lista-simples">
        <li><span>Hoje</span><strong>+${g.hojeXp}${g.sequencia.dias > 1 ? ` · 🔥 ${g.sequencia.dias} dias` : ''}</strong></li>
        <li><span>Para gastar</span><strong>${pts(g.saldo)}</strong></li>
      </ul>
      ${alvo ? (g.podeResgatar.length
        ? `<a class="botao botao-secundario botao-pequeno" href="#financas/recompensas">Já dá para: ${esc(alvo.emoji || '')} ${esc(alvo.nome)}</a>`
        : `<p class="campo-ajuda">Faltam ${pts(alvo.custo - g.saldo)} para ${esc(alvo.emoji || '')} ${esc(alvo.nome)}</p>`) : ''}
    </section>`;
}
