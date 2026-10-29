// Telas de Fechar o dia (#cantinho/fechar) e do Diário do mês (#cantinho/diario).

import { esc } from './utilidades.js';
import { HUMORES, linhaDoDiario, fechamentoDe, rostoDoHumor, resumoDoDia, mesDoDiario, nomeDoMes, NOMES_DIA, mesDe } from './dados-fechar.js';
import { horasDeDeitar, textoDuracao } from './dados-cantinho.js';
import { habitoAgua } from './views-cuidar.js';

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric' });

export function telaFechar(estado, topo, c, hoje) {
  const linha = linhaDoDiario(estado, hoje);
  const f = fechamentoDe(linha);
  const agua = habitoAgua(estado, hoje);
  const r = resumoDoDia(estado, c, hoje, agua);
  const deitar = c.deitar || horasDeDeitar(c.acordar)[1]?.hora;
  const sub = f ? `Fechado às ${fmtHora.format(new Date(f.fechado_em))}. Boa noite.` : '60 segundos: como foi, uma coisa boa e o que fica para amanhã.';
  const numeros = [
    r.pausas ? `🫁 ${r.pausas} ${r.pausas === 1 ? 'pausa' : 'pausas'}` : '',
    agua ? `💧 ${agua.valor}/${agua.meta} ${agua.unidade}` : '',
    r.leitura ? `📖 ${textoDuracao(r.leitura)} de leitura` : '',
    r.habitos.total ? `✨ ${r.habitos.feitos} de ${r.habitos.total} hábitos` : '',
    r.feitas ? `✓ ${r.feitas} ${r.feitas === 1 ? 'coisa sua feita' : 'coisas suas feitas'}` : '',
  ].filter(Boolean);
  return `
    ${topo('Fechar o dia', { voltar: true, sub })}
    <div class="ct-grade">
      <section class="ct-card">
        <form class="ct-fechar" data-form="fd-fechar" novalidate>
          <p class="ct-rotulo">Como foi o dia?</p>
          <div class="ct-humores" role="group" aria-label="Humor">${HUMORES.map((h) => `
            <button class="ct-humor" type="button" data-acao="fd-humor" data-valor="${h.valor}" aria-pressed="${Number(linha?.humor) === h.valor}" title="${esc(h.nome)}"><span aria-hidden="true">${h.rosto}</span><small>${esc(h.nome)}</small></button>`).join('')}</div>
          <input type="hidden" name="humor" value="${Number(linha?.humor) > 0 ? Number(linha.humor) : ''}">
          <label class="campo"><span class="campo-rotulo">Uma coisa boa de hoje</span><input name="bom" type="text" maxlength="160" placeholder="o café da manhã na janela" value="${esc(f?.bom || '')}"></label>
          <label class="campo"><span class="campo-rotulo">Uma linha sobre o dia</span><textarea name="texto" rows="2" maxlength="500" placeholder="opcional">${esc(linha?.texto || '')}</textarea></label>
          <label class="campo"><span class="campo-rotulo">O que fica para amanhã</span><input name="amanha" type="text" maxlength="200" placeholder="vira um lembrete de amanhã e sai da cabeça" value="${esc(f?.amanha || '')}"></label>
          <div class="acoes">
            <button class="botao botao-primario" type="submit">${f ? 'Guardar' : 'Fechar o dia'}</button>
            ${f ? '<a class="botao botao-secundario" href="#cantinho/mesinha">Mesinha</a>' : ''}
            <a class="ct-link" href="#cantinho/diario">ver o mês</a>
          </div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
      <section class="ct-card">
        <p class="ct-rotulo">O dia em números</p>
        ${numeros.length ? `<div class="ct-linha-dia">${numeros.map((n) => `<span class="ct-pilula">${esc(n)}</span>`).join('')}</div>` : '<p class="texto-suave">Nada contado ainda hoje. Tudo bem: dia de descanso também conta.</p>'}
        <p class="ct-rotulo ct-rotulo-meio">Para dormir</p>
        <p class="texto-suave">Deitar até <strong>${esc(deitar)}</strong> para acordar às ${esc(c.acordar)}.${c.lembrete ? ' Aviso 30 min antes.' : ''}</p>
        <div class="acoes"><a class="botao botao-secundario" href="#cantinho/dormir">Ajustar</a><a class="botao botao-secundario" href="#cantinho/mesinha">Mesinha</a></div>
      </section>
    </div>`;
}

export function telaDiario(estado, topo, hoje) {
  const mes = estado.mesDiario || mesDe(hoje);
  const m = mesDoDiario(estado, mes, hoje);
  const media = m.media ? rostoDoHumor(Math.round(m.media)) : null;
  const escritos = m.dias.filter((d) => d.texto || d.bom).reverse();
  return `
    ${topo('Diário', { voltar: true, sub: 'O mês em rostinhos e as linhas que você escreveu.' })}
    <div class="ct-diario-topo">
      <button class="ct-passo" type="button" data-acao="fd-mes" data-delta="-1" aria-label="Mês anterior">‹</button>
      <h2 class="ct-mes" data-ct-mes>${esc(nomeDoMes(mes))}</h2>
      <button class="ct-passo" type="button" data-acao="fd-mes" data-delta="1" aria-label="Próximo mês"${mes >= mesDe(hoje) ? ' disabled' : ''}>›</button>
    </div>
    <div class="ct-grade">
      <section class="ct-card">
        <div class="ct-diario-grade" role="grid" aria-label="Humor por dia">
          ${NOMES_DIA.map((n) => `<span class="ct-diario-cab">${n}</span>`).join('')}
          ${'<span></span>'.repeat(m.vazioAntes)}
          ${m.dias.map((d) => {
    const rosto = rostoDoHumor(d.humor);
    return `<span class="ct-diario-dia${d.hoje ? ' hoje' : ''}${d.futuro ? ' futuro' : ''}${d.fechado ? ' fechado' : ''}" title="${esc(d.data)}${rosto ? ` · ${esc(rosto.nome)}` : ''}"><small>${d.dia}</small><b aria-hidden="true">${rosto ? rosto.rosto : d.futuro ? '' : '·'}</b></span>`;
  }).join('')}
        </div>
        <div class="ct-linha-dia">
          <span class="ct-pilula">${media ? `${media.rosto} média <b>${esc(media.nome)}</b>` : 'sem humor registrado'}</span>
          <span class="ct-pilula">📝 <b>${m.fechados}</b> ${m.fechados === 1 ? 'dia fechado' : 'dias fechados'}</span>
          <span class="ct-pilula">✍️ <b>${m.escritos}</b> com uma linha</span>
        </div>
      </section>
      <section class="ct-card">
        <p class="ct-rotulo">As linhas do mês</p>
        ${escritos.length ? `<ul class="ct-lista">${escritos.map((d) => {
    const rosto = rostoDoHumor(d.humor);
    return `
          <li class="ct-item">
            <span class="ct-quando">${esc(fmtDia.format(new Date(`${d.data}T12:00:00`)).replace('.', ''))}</span>
            <span class="ct-item-texto">${d.bom ? `<b>${rosto ? `${rosto.rosto} ` : ''}${esc(d.bom)}</b>` : rosto ? `<b>${rosto.rosto} ${esc(rosto.nome)}</b>` : ''}${d.texto ? `<small>${esc(d.texto)}</small>` : ''}</span>
          </li>`;
  }).join('')}</ul>` : '<p class="texto-suave">Nenhuma linha neste mês. O "Fechar o dia" guarda uma por noite, em 60 segundos.</p>'}
      </section>
    </div>`;
}
