// Ritual de leitura: o card "Leitura de hoje" no Hoje e a meta em Configurações.

import { esc } from './utilidades.js';
import { barraProgresso } from './componentes.js';
import { leituraDe, minutosNoDia, sequenciaLeitura, livroDoMomento, encaixeDeHoje, OPCOES_META_LEITURA, textoMin } from './dados-leitura.js';
import { dataLocal } from './views-dia.js';

export function cardLeituraHoje(estado, agora = Date.now()) {
  const hoje = dataLocal(agora);
  const leitura = leituraDe(estado.config);
  const lidos = minutosNoDia(leitura, hoje);
  const seq = sequenciaLeitura(leitura, hoje);
  const atual = livroDoMomento(estado.artigos);
  const encaixe = encaixeDeHoje(estado.eventos, agora);
  const falta = Math.max(0, leitura.metaMin - lidos);
  const capa = atual?.livro.dados?.capa;
  const pct = Number(atual?.livro.dados?.pct) || 0;
  return `
    <section class="card leitura-hoje" aria-labelledby="leitura-hoje-titulo">
      <div class="card-topo">
        <h2 class="card-titulo" id="leitura-hoje-titulo">Leitura de hoje${seq.dias >= 2 ? ` <span class="selo" title="Dias seguidos batendo a meta${seq.folgaUsada ? ' (com uma folga)' : ''}">🔥 ${seq.dias}</span>` : ''}</h2>
        <a class="card-link" href="#biblioteca">Biblioteca</a>
      </div>
      <p class="leitura-meta"><strong>${esc(textoMin(lidos))}</strong><span class="campo-ajuda"> de ${esc(textoMin(leitura.metaMin))} hoje${falta === 0 ? ' · meta batida ✨' : ''}</span></p>
      ${barraProgresso(Math.min(1, lidos / leitura.metaMin), 'Minutos lidos hoje')}
      ${atual ? `
      <a class="leitura-livro" href="#livro/${esc(atual.livro.id)}" data-leitura-livro>
        ${capa ? `<img class="leitura-capa" src="${esc(capa)}" alt="">` : '<span class="leitura-capa leitura-capa-vazia" aria-hidden="true">📖</span>'}
        <span class="leitura-texto">
          <strong>${esc(atual.livro.titulo)}</strong>
          <small class="campo-ajuda">${atual.comecando ? 'Na fila: começar hoje?' : `${Math.round(pct * 100)}% lido`}${encaixe && falta > 0 && encaixe.minutos >= falta ? ` · cabe antes de ${esc(encaixe.titulo)} às ${esc(encaixe.hora)}` : encaixe && falta > 0 ? ` · ${esc(encaixe.titulo)} às ${esc(encaixe.hora)}: dá ${encaixe.minutos} min` : ''}</small>
          <span class="botao botao-primario botao-pequeno">${atual.comecando ? 'Começar' : falta > 0 ? `Ler ${esc(textoMin(falta))}` : 'Continuar lendo'}</span>
        </span>
      </a>` : '<p class="texto-suave">Nenhum livro na estante. <a href="#biblioteca/novo">Adicionar um livro</a> para o ritual começar.</p>'}
    </section>`;
}

export function cardConfigLeitura(estado) {
  const leitura = leituraDe(estado.config);
  return `
    <section class="card" aria-labelledby="config-leitura">
      <h2 class="card-titulo" id="config-leitura">Ritual de leitura</h2>
      <p class="texto-suave">Quantos minutos por dia você quer ler. O leitor conta o tempo sozinho enquanto o livro está na tela; a sequência perdoa uma folga por semana.</p>
      <label class="campo"><span class="campo-rotulo">Meta por dia</span>
        <select name="leitura-meta" data-acao-mudar="leitura-meta">${OPCOES_META_LEITURA.map((m) => `<option value="${m}"${m === leitura.metaMin ? ' selected' : ''}>${m} min</option>`).join('')}</select>
      </label>
    </section>`;
}
