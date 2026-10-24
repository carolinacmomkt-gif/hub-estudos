// Cliques e formulários do modo "Personalizar o Início".

import { obterEstado, atualizarEstado } from './estado.js';
import {
  moverBloco, mudarTamanho, alternarVisivel, adicionarProprio, editarProprio, removerProprio, marcarItem, voltarAoPadrao,
  blocosDoInicio, TIPOS_PROPRIOS,
} from './inicio-layout.js';
import { renderFormProprio, lerFormProprio } from './views-inicio-proprios.js';

let app; // { renderizar, avisoCurto }

export function ligarInicio(funcoes) {
  app = funcoes;
}

// Redesenha e devolve o foco ao mesmo controle (as setas continuam na mão).
function redesenhar(seletor) {
  app.renderizar();
  if (seletor) document.querySelector(seletor)?.focus({ preventScroll: false });
}

function abrirFormulario(tipo, id = '') {
  const card = id ? blocosDoInicio(obterEstado()).proprios[id] : {};
  const nome = TIPOS_PROPRIOS.find((t) => t.id === tipo)?.nome || 'Card';
  document.getElementById('folha-evento-titulo').textContent = id ? `Editar: ${card?.titulo || nome}` : `Novo card: ${nome}`;
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormProprio(tipo, card || {}, id);
  document.getElementById('folha-evento').showModal();
}

export function cliqueInicio(alvo) {
  const id = alvo.dataset.id;
  switch (alvo.dataset.acao) {
    case 'inicio-personalizar':
      atualizarEstado({ editandoInicio: true });
      redesenhar('[data-acao="inicio-pronto"]');
      return true;
    case 'inicio-pronto':
      atualizarEstado({ editandoInicio: false });
      redesenhar();
      app.avisoCurto('Início salvo. Vale para todos os seus aparelhos.');
      return true;
    case 'inicio-mover': {
      const passo = alvo.dataset.passo;
      moverBloco(id, Number(passo)).then(() => redesenhar(`[data-acao="inicio-mover"][data-id="${id}"][data-passo="${passo}"]:not([disabled])`));
      return true;
    }
    case 'inicio-visivel':
      alternarVisivel(id).then(() => redesenhar(`[data-acao="inicio-visivel"][data-id="${id}"]`));
      return true;
    case 'inicio-novo':
      abrirFormulario(alvo.dataset.tipo);
      return true;
    case 'inicio-editar': {
      const card = blocosDoInicio(obterEstado()).proprios[id];
      if (card) abrirFormulario(card.tipo, id);
      return true;
    }
    case 'inicio-remover':
      if (!window.confirm('Excluir este card do Início?')) return true;
      removerProprio(id).then(() => {
        document.getElementById('folha-evento').close();
        redesenhar();
      });
      return true;
    case 'inicio-padrao':
      if (!window.confirm('Voltar o Início ao padrão? Seus cards próprios ficam guardados, só que ocultos.')) return true;
      voltarAoPadrao().then(() => redesenhar());
      return true;
    case 'inicio-marcar':
      marcarItem(id, Number(alvo.dataset.indice)).then(() => redesenhar());
      return true;
    default:
      return false;
  }
}

export function mudancaInicio(alvo) {
  if (alvo.dataset.acaoMudar !== 'inicio-tamanho') return false;
  const id = alvo.dataset.id;
  mudarTamanho(id, alvo.value).then(() => redesenhar(`#tam-${CSS.escape(id)}`));
  return true;
}

export function enviarInicio(form) {
  if (form.dataset.form !== 'inicio-proprio') return false;
  const { dados, erro } = lerFormProprio(form);
  const caixa = form.querySelector('[data-erro]');
  if (erro) {
    caixa.textContent = erro;
    caixa.hidden = false;
    return true;
  }
  const id = form.dataset.id;
  (id ? editarProprio(id, dados) : adicionarProprio(form.dataset.tipo, dados)).then(() => {
    document.getElementById('folha-evento').close();
    redesenhar();
    app.avisoCurto(id ? 'Card atualizado.' : 'Card adicionado no topo do Início.');
  });
  return true;
}
