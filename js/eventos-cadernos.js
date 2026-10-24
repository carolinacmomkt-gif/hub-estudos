// Criar caderno (botão na tela Cadernos e atalho do "+").

import { obterEstado } from './estado.js';
import { salvar } from './persistencia.js';
import { renderFormCaderno } from './views-cadernos.js';
import { dimensoes } from './folhas.js';
import { novaPaginaVazia } from './editor-tinta.js';

export function cliqueCadernos(alvo) {
  if (alvo.dataset.acao !== 'caderno-novo') return false;
  document.getElementById('folha-criar')?.close();
  document.getElementById('folha-evento-titulo').textContent = 'Novo caderno';
  document.getElementById('folha-evento-conteudo').innerHTML = renderFormCaderno(obterEstado());
  document.getElementById('folha-evento').showModal();
  document.querySelector('[data-form="caderno-novo"] [name=titulo]')?.focus();
  return true;
}

export function enviarCadernos(form) {
  if (form.dataset.form !== 'caderno-novo') return false;
  criar(form);
  return true;
}

async function criar(form) {
  const c = form.elements;
  const titulo = c.titulo.value.trim();
  if (!titulo) {
    const erro = form.querySelector('[data-erro]');
    erro.textContent = 'Dê um título ao caderno.';
    erro.hidden = false;
    return;
  }
  form.querySelector('[type="submit"]').disabled = true;
  const modelo = c.modelo.value;
  const caderno = await salvar('cadernos', {
    titulo: titulo.slice(0, 80),
    tipo: 'comum',
    disciplina_id: c.disciplina.value || null,
    tamanho: c.tamanho.value,
    orientacao: c.orientacao.value,
    capa: { cor: Number(c.capa.value) || 1 },
    tags: [],
  });
  const dim = dimensoes(caderno.tamanho, caderno.orientacao);
  await salvar('paginas', {
    caderno_id: caderno.id, ordem: 0, modelo_folha: modelo, tracos_json: novaPaginaVazia(modelo), largura: dim.largura, altura: dim.altura,
  });
  document.getElementById('folha-evento').close();
  location.hash = `#cadernos/${caderno.id}`;
}
