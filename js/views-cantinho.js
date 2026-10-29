// Telas do Meu cantinho: entrada (#cantinho), Dormir (#cantinho/dormir), Pausas (#cantinho/pausas)
// e a mesinha (#cantinho/mesinha). Noite estrelada em vidro, na paleta da Bússola.

import { esc, saudacao } from './utilidades.js';
import { icone } from './icones.js';
import { fraseDoDia } from './frases.js';
import { dataLocal, minutoAgora } from './views-dia.js';
import { habitosDoDia, valorNoDia } from './dados-habitos.js';
import { leituraDe, minutosNoDia, livroDoMomento } from './dados-leitura.js';
import {
  cantinhoDe, horasDeDeitar, horasDeAcordar, faltaParaAcordar, contagemParaDeitar, PAUSAS, pausaQueCabe, proximoComHora,
  minutosSemParar, pausasDoDia, textoDuracao, paraHora, paraMin, ehNoite,
} from './dados-cantinho.js';
import { AMBIENTES } from './foco-palco.js';
import { telaCuidar, telaDesejos, telaPessoas, resumoParaCantos } from './views-cuidar.js';

const fmtData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const SONS = AMBIENTES.filter((a) => a.id).map((a) => ({ ...a, emoji: { chuva: '🌧️', marrom: '🌊', lareira: '🔥' }[a.id] || '🎧' }));

export function relogioAgora(agora = Date.now()) {
  const d = new Date(agora);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Cabeçalho próprio do cantinho (sem a lupa nem o seletor de tema: aqui é descanso).
function topoCantinho(titulo, { voltar = false, sub = '' } = {}) {
  return `
    <header class="ct-topo">
      ${voltar ? `<a class="botao-icone ct-voltar" href="#cantinho" aria-label="Voltar ao cantinho" title="Voltar">‹</a>` : ''}
      <div class="ct-topo-texto"><p class="ct-rotulo">Meu cantinho</p><h1 class="ct-titulo" tabindex="-1">${esc(titulo)}</h1>${sub ? `<p class="ct-sub">${esc(sub)}</p>` : ''}</div>
      <div class="ct-topo-acoes">
        ${voltar ? '' : `<button class="botao botao-secundario botao-pequeno ct-botao-lua" type="button" data-acao="ct-mesinha">${icone('cantinho')}Mesinha</button>`}
      </div>
    </header>`;
}

// O clima do momento, para a linha embaixo da saudação.
function climaDoMomento(agoraMin) {
  const h = agoraMin / 60;
  if (h < 5) return 'Ainda é madrugada. Volta a dormir?';
  if (h < 12) return 'Começa devagar. O dia cabe.';
  if (h < 18) return 'Uma pausa no meio do dia faz o resto render.';
  return 'Hora de desacelerar.';
}

function linhaDoDia(estado, c, hoje, agoraMin) {
  const itens = [];
  const agua = habitosDoDia(estado.habitos || [], estado.habitoRegistros || [], hoje).lista.find((h) => /água/i.test(h.nome));
  if (agua) itens.push(`<span class="ct-pilula"><span aria-hidden="true">💧</span><b>${valorNoDia(estado.habitoRegistros || [], agua, hoje)}/${Number(agua.meta) || 1}</b> ${esc(agua.unidade || '')}</span>`);
  const leitura = leituraDe(estado.config);
  const lidos = minutosNoDia(leitura, hoje);
  if (lidos > 0 || livroDoMomento(estado.artigos)) itens.push(`<span class="ct-pilula"><span aria-hidden="true">📖</span><b>${lidos}</b> de ${leitura.metaMin} min</span>`);
  const deitar = c.deitar || horasDeDeitar(c.acordar)[1]?.hora;
  itens.push(`<a class="ct-pilula" href="#cantinho/dormir"><span aria-hidden="true">🌙</span>deitar até <b>${esc(deitar)}</b>${c.deitar ? '' : ' <span class="ct-pilula-nota">sugestão</span>'}</a>`);
  return `<div class="ct-linha-dia">${itens.join('')}</div>`;
}

function cartaoPausaQueCabe(estado, c, hoje, agoraMin) {
  const proximo = proximoComHora({ eventos: estado.eventos, tarefas: estado.tarefas }, hoje, agoraMin);
  const { pausa, livre } = pausaQueCabe(proximo, agoraMin);
  const semParar = minutosSemParar(c, hoje, Date.now(), estado.abriuEm || Date.now());
  const feitas = pausasDoDia(c, hoje).length;
  if (!pausa) {
    return `<div class="ct-faixa"><div><strong>Daqui a ${livre} min tem ${esc(proximo.titulo)}</strong><small>Respira fundo, toma uma água. Depois dela, a pausa.</small></div></div>`;
  }
  const quando = proximo ? `a próxima coisa com hora é ${esc(proximo.titulo)} às ${paraHora(proximo.min)}` : 'nada com hora pela frente hoje';
  const sem = semParar >= 45 ? ` · você está há ${textoDuracao(semParar)} sem parar` : feitas ? ` · ${feitas} ${feitas === 1 ? 'pausa feita' : 'pausas feitas'} hoje` : '';
  return `
    <div class="ct-faixa">
      <div><strong>${pausa.id === 'sair' ? `Dá para sair ${pausa.minutos} min` : `Cabe ${pausa.nome.toLowerCase()} ${pausa.minutos} min`}</strong><small>${quando}${sem}</small></div>
      <button class="botao botao-primario" type="button" data-acao="ct-pausa" data-tipo="${esc(pausa.id)}">Começar</button>
    </div>`;
}

function cantos(estado, c, hoje) {
  const feitas = pausasDoDia(c, hoje);
  const deitar = c.deitar || horasDeDeitar(c.acordar)[1]?.hora;
  const livro = livroDoMomento(estado.artigos);
  const leitura = leituraDe(estado.config);
  const faltaLer = Math.max(0, leitura.metaMin - minutosNoDia(leitura, hoje));
  const r = resumoParaCantos(estado, hoje);
  const lista = [
    { rota: '#cantinho/pausas', emoji: '🫁', nome: 'Pausas', texto: feitas.length ? `${feitas.length} hoje · respirar, alongar, cochilo, sair` : 'respirar 2 min · alongar 5 · cochilo 20 · sair 10' },
    { rota: '#cantinho/dormir', emoji: '🌙', nome: 'Dormir', texto: `deitar até ${deitar} · acordar ${c.acordar}` },
    { rota: '#cantinho/cuidar', emoji: '💧', nome: 'Cuidar de mim', texto: r.cuidar },
    { rota: livro ? `#livro/${livro.livro.id}` : '#biblioteca', emoji: '📖', nome: 'Ler devagar', texto: livro ? `${livro.livro.titulo}${faltaLer ? ` · faltam ${faltaLer} min` : ' · meta de hoje batida'}` : 'nenhum livro na estante ainda' },
    { rota: '#cantinho/pessoas', emoji: '🎂', nome: 'Pessoas', texto: r.pessoas },
    { rota: '#cantinho/desejos', emoji: '🎁', nome: 'Desejos', texto: r.desejos },
    { rota: '#cantinho/pausas', emoji: '🎧', nome: 'Sons', texto: `${SONS.map((s) => s.nome.toLowerCase()).join(' · ')}` },
    { rota: '#inicio', emoji: '📝', nome: 'Fechar o dia', texto: 'humor, uma linha, o que fica para amanhã', breve: true },
  ];
  return `<div class="ct-cantos">${lista.map((x) => `
    <a class="ct-card ct-canto" href="${esc(x.rota)}">
      <span class="ct-disco" aria-hidden="true">${x.emoji}</span>
      ${x.breve ? '<span class="ct-selo">em breve</span>' : ''}
      <span class="ct-canto-texto"><b>${esc(x.nome)}</b><small>${esc(x.texto)}</small></span>
    </a>`).join('')}</div>`;
}

export function renderCantinho(estado) {
  const c = cantinhoDe(estado.config);
  const hoje = dataLocal();
  const agoraMin = minutoAgora();
  const sub = estado.parametro;
  if (sub === 'dormir') return telaDormir(estado, c, agoraMin);
  if (sub === 'pausas') return telaPausas(estado, c, hoje);
  if (sub === 'mesinha') return telaMesinha(estado, c, agoraMin);
  if (sub === 'cuidar') return telaCuidar(estado, topoCantinho, hoje);
  if (sub === 'desejos') return telaDesejos(estado, topoCantinho);
  if (sub === 'pessoas') return telaPessoas(estado, topoCantinho, hoje);
  const frase = fraseDoDia();
  const semParar = minutosSemParar(c, hoje, Date.now(), estado.abriuEm || Date.now());
  const ultima = c.ultimaPausa && String(c.ultimaPausa).slice(0, 10) === hoje ? relogioAgora(Date.parse(c.ultimaPausa)) : null;
  const parou = ultima ? `você parou por último às ${ultima}` : semParar >= 45 ? `você está há ${textoDuracao(semParar)} sem parar` : 'sem pausa ainda hoje';
  return `
    ${topoCantinho(saudacao(estado.dados?.nome || 'Carol'), { sub: climaDoMomento(agoraMin) })}
    <div class="ct-entrada">
      <div class="ct-agora">
        <div class="ct-hora-linha"><p class="ct-hora" data-ct-relogio>${relogioAgora()}</p><div class="ct-lua" aria-hidden="true"></div></div>
        <p class="ct-data">${esc(fmtData.format(new Date()))} · ${esc(parou)}</p>
        ${cartaoPausaQueCabe(estado, c, hoje, agoraMin)}
        ${linhaDoDia(estado, c, hoje, agoraMin)}
        <blockquote class="ct-frase">“${esc(frase.texto)}”<small>${esc(frase.autor || '')}</small></blockquote>
      </div>
      ${cantos(estado, c, hoje)}
    </div>
    ${ehNoite(agoraMin) && c.mesinhaAuto ? '<p class="ct-dica">É noite: toque em <strong>Mesinha</strong> para deixar o aparelho apoiado como relógio de cabeceira.</p>' : ''}`;
}

// ---------------------------------------------------------------------------
// Dormir
// ---------------------------------------------------------------------------

function telaDormir(estado, c, agoraMin) {
  const opcoes = horasDeDeitar(c.acordar);
  const falta = faltaParaAcordar(c.acordar, agoraMin);
  const agora = horasDeAcordar(agoraMin);
  const contagem = c.deitar ? contagemParaDeitar(c.deitar) : [];
  const chips = ['05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00'];
  const pontos = (n) => `<span class="ct-pontos" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i${i < n ? '' : ' class="apagado"'}></i>`).join('')}</span>`;
  return `
    ${topoCantinho('Dormir', { voltar: true, sub: 'Ciclos de 90 minutos, já contando 15 para pegar no sono.' })}
    <div class="ct-dormir">
      <section class="ct-card ct-acordar-card">
        <p class="ct-pergunta">A que horas você quer acordar?</p>
        <form class="ct-acordar" data-form="ct-acordar" novalidate>
          <span class="ct-acordar-passo">
            <button class="ct-passo" type="button" data-acao="ct-acordar-passo" data-delta="-15" aria-label="15 minutos antes">−</button>
            <label class="ct-acordar-grande"><span aria-hidden="true">${esc(c.acordar)}</span><input class="ct-acordar-campo" name="acordar" type="time" value="${esc(c.acordar)}" aria-label="Hora de acordar" data-acao-mudar="ct-acordar"></label>
            <button class="ct-passo" type="button" data-acao="ct-acordar-passo" data-delta="15" aria-label="15 minutos depois">+</button>
          </span>
          <span class="ct-falta">${falta !== null ? `faltam ${textoDuracao(falta)}` : ''}</span>
        </form>
        <div class="ct-chips">${chips.map((h) => `<button class="ct-chip${h === c.acordar ? ' sel' : ''}" type="button" data-acao="ct-acordar-chip" data-valor="${h}">${h}</button>`).join('')}</div>
      </section>
      <section class="ct-card">
        <p class="ct-pergunta">Então deite até…</p>
        <ol class="ct-ciclos">${opcoes.map((o) => `
          <li><button class="ct-ciclo${c.deitar === o.hora ? ' sel' : ''}" type="button" data-acao="ct-deitar" data-valor="${esc(o.hora)}" aria-pressed="${c.deitar === o.hora}">
            <b>${esc(o.hora)}</b>
            <span class="ct-ciclo-info"><span><strong>${o.ciclos} ciclos</strong> · ${esc(textoDuracao(o.dormidas))} dormidas</span>${pontos(o.ciclos)}</span>
            <span class="ct-tag ct-tag--${esc(o.tag === 'dá' ? 'da' : o.tag)}">${c.deitar === o.hora ? 'escolhida' : esc(o.tag)}</span>
          </button></li>`).join('')}</ol>
        <p class="campo-ajuda ct-nota">Se deitar agora (${paraHora(agoraMin)}), acorde às ${agora.map((a) => a.hora).join(', ')}.</p>
        <label class="ct-liga"><input type="checkbox" data-acao-mudar="ct-lembrete"${c.lembrete ? ' checked' : ''}> Lembrar de desligar (aviso 30 min antes)</label>
        ${c.deitar ? `<div class="acoes"><button class="botao botao-primario" type="button" data-acao="ct-mesinha">Deito às ${esc(c.deitar)} · mesinha</button></div>` : ''}
      </section>
      <div class="ct-coluna">
        ${contagem.length ? `<section class="ct-card">
          <p class="ct-rotulo">Para chegar bem às ${esc(c.deitar)}</p>
          <ul class="ct-contagem">${contagem.map((x) => `<li><span><span aria-hidden="true">${x.emoji}</span> ${esc(x.nome)}</span><b>${esc(x.hora)}</b></li>`).join('')}</ul>
        </section>` : ''}
        <section class="ct-card">
          <p class="ct-rotulo">Sons para dormir</p>
          ${somChips(c)}
          <p class="campo-ajuda ct-nota">Gerados no aparelho, sem internet. Somem sozinhos em 30 minutos.</p>
        </section>
        <section class="ct-card">
          <p class="ct-rotulo">Acordei no meio da noite</p>
          <p class="texto-suave">Respiração lenta, luz mínima, sem relógio na cara. Dois toques para sair.</p>
          <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="ct-pausa" data-tipo="respirar" data-noite="1">Me ajuda a voltar a dormir</button></div>
        </section>
      </div>
    </div>`;
}

function somChips(c, { tocando = null } = {}) {
  return `<div class="ct-sons">${SONS.map((s) => `<button class="ct-som${(tocando ?? c.som) === s.id ? ' on' : ''}" type="button" data-acao="ct-som" data-tipo="${esc(s.id)}" aria-pressed="${(tocando ?? c.som) === s.id}"><span aria-hidden="true">${s.emoji}</span>${esc(s.nome)}</button>`).join('')}
    <button class="ct-som" type="button" data-acao="ct-som" data-tipo="" aria-pressed="false"><span aria-hidden="true">🔇</span>Silêncio</button></div>`;
}

// ---------------------------------------------------------------------------
// Pausas
// ---------------------------------------------------------------------------

function telaPausas(estado, c, hoje) {
  const feitas = pausasDoDia(c, hoje);
  const agoraMin = minutoAgora();
  return `
    ${topoCantinho('Pausas', { voltar: true, sub: 'Tudo com tempo marcado. A tela entra no modo calmo e nada te interrompe.' })}
    <div class="ct-pausas-topo">
      <div class="ct-respira-previa" aria-hidden="true"><span>inspira</span></div>
      ${cartaoPausaQueCabe(estado, c, hoje, agoraMin)}
    </div>
    <div class="ct-pausas">
      ${PAUSAS.map((p) => `
        <button class="ct-card ct-pausa" type="button" data-acao="ct-pausa" data-tipo="${esc(p.id)}">
          <span class="ct-disco" aria-hidden="true">${p.emoji}</span>
          <span class="ct-pausa-texto"><b>${esc(p.nome)}</b><small>${esc(p.texto)}</small></span>
          <span class="ct-pausa-tempo">${p.minutos} min</span>
        </button>`).join('')}
      <button class="ct-card ct-pausa ct-cheia" type="button" data-acao="ct-esvaziar">
        <span class="ct-disco" aria-hidden="true">🫗</span>
        <span class="ct-pausa-texto"><b>Esvaziar a cabeça</b><small>Escreva o que está rodando; vira um lembrete para amanhã e sai da frente.</small></span>
        <span class="ct-pausa-tempo">${icone('editar')}</span>
      </button>
      <section class="ct-card">
        <p class="ct-rotulo">Sons</p>
        ${somChips(c)}
      </section>
      <section class="ct-card">
        <p class="ct-rotulo">Lembrete</p>
        <label class="ct-liga"><input type="checkbox" data-acao-mudar="ct-lembrete-parar"${c.lembreteParar ? ' checked' : ''}> Parar a cada 90 min com o app aberto</label>
        ${feitas.length ? `<p class="ct-rotulo" style="margin-top:12px">Hoje</p><div class="ct-hoje">${feitas.map((f) => `<span class="ct-selo">${esc(PAUSAS.find((p) => p.id === f.tipo)?.nome || f.tipo)} ${f.minutos} min</span>`).join('')}</div>` : ''}
      </section>
    </div>`;
}

// A pausa acontecendo (por cima de tudo).
export function htmlPausaAberta(p, { noite = false } = {}) {
  return `
    <div class="ct-pausa-aberta${noite ? ' noite' : ''}" data-ct-pausa="${esc(p.id)}" role="dialog" aria-label="${esc(p.nome)}">
      <div class="ct-pausa-centro">
        ${p.id === 'respirar' ? '<div class="ct-respira" data-ct-respira><span data-ct-fase>inspira</span></div>' : `<p class="ct-pausa-emoji-grande" aria-hidden="true">${p.emoji}</p>`}
        <p class="ct-pausa-nome">${esc(p.nome)}</p>
        <p class="ct-pausa-restante" data-ct-restante>${p.minutos}:00</p>
        <p class="ct-pausa-passo" data-ct-passo>${p.id === 'alongar' ? 'Pescoço: deixe a cabeça pender para um lado, depois para o outro. Devagar.' : p.id === 'respirar' ? 'inspira 4 · segura 7 · solta 8' : p.id === 'cochilo' ? 'Um som suave te acorda. Pode fechar os olhos.' : 'Sem celular. Volte quando o tempo acabar, ou antes.'}</p>
      </div>
      <div class="ct-pausa-acoes">
        <button class="botao botao-secundario" type="button" data-acao="ct-pausa-parar">Parar</button>
        <button class="botao botao-primario" type="button" data-acao="ct-pausa-pronta">Terminei</button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Mesinha (relógio de cabeceira)
// ---------------------------------------------------------------------------

function telaMesinha(estado, c, agoraMin) {
  const frase = fraseDoDia();
  const falta = faltaParaAcordar(c.acordar, agoraMin);
  const deitar = c.deitar || horasDeDeitar(c.acordar)[1]?.hora;
  return `
    <div class="ct-mesinha${ehNoite(agoraMin) ? ' quente' : ''}" data-ct-mesinha>
      <div class="ct-lua" aria-hidden="true"></div>
      <div class="ct-mesinha-centro">
        <p class="ct-mesinha-hora" data-ct-relogio>${relogioAgora()}</p>
        <p class="ct-mesinha-data">${esc(fmtData.format(new Date()))}${falta !== null ? ` · faltam ${esc(textoDuracao(falta))} para as ${esc(c.acordar)}` : ''}</p>
        <blockquote class="ct-frase">“${esc(frase.texto)}”<small>${esc(frase.autor || '')}</small></blockquote>
      </div>
      <div class="ct-mesinha-lado">
        <div class="ct-card ct-mesinha-card"><p class="ct-rotulo">${c.deitar ? 'Deitar até' : 'Deitar até (sugestão)'}</p><strong>${esc(deitar)}</strong><small>para acordar às ${esc(c.acordar)}</small></div>
        <div class="ct-card ct-mesinha-card"><p class="ct-rotulo">Som</p>${somChips(c)}</div>
      </div>
      <div class="ct-mesinha-pe">
        <button class="ct-chip" type="button" data-acao="ct-pausa" data-tipo="respirar" data-noite="1">Respirar</button>
        <button class="ct-chip" type="button" data-acao="ct-pausa" data-tipo="cochilo">Cochilo 20 min</button>
        <button class="ct-chip" type="button" data-acao="ct-mesinha-sair">Sair</button>
        <span class="ct-mesinha-dica">escurece sozinha · dois toques saem</span>
      </div>
    </div>`;
}

export const nomeDoSom = (id) => SONS.find((s) => s.id === id)?.nome || 'Silêncio';
export { PAUSAS, paraMin };
