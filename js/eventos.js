// Cliques e interações globais (delegação no documento).

import { definirTema } from './tema.js';
import { testarConexaoAva } from './ava.js';
import { renderCarregandoAva, renderResultadoAva } from './views-configuracoes.js';

async function enviarTesteAva(form) {
  const botao = form.querySelector('[type="submit"]');
  const saida = document.getElementById('ava-resultado');
  const campos = Object.fromEntries(new FormData(form));

  if (!campos.matricula?.trim() || !campos.senha || !campos.codigo) {
    saida.innerHTML = renderResultadoAva({ ok: false, erro: 'Preencha a matrícula, a senha e o código de acesso.' });
    return;
  }

  botao.disabled = true;
  saida.innerHTML = renderCarregandoAva();
  try {
    const resultado = await testarConexaoAva({
      matricula: campos.matricula.trim(),
      senha: campos.senha,
      codigo: campos.codigo,
    });
    saida.innerHTML = renderResultadoAva(resultado);
    saida.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } finally {
    // A senha não fica na tela depois do teste.
    form.elements.senha.value = '';
    botao.disabled = false;
  }
}

export function ligarEventos() {
  const folhaMais = document.getElementById('folha-mais');

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-tema-opcao], [data-acao], a[href^="#"]');
    if (!alvo) return;

    if (alvo.dataset.temaOpcao) {
      definirTema(alvo.dataset.temaOpcao);
      return;
    }

    switch (alvo.dataset.acao) {
      case 'abrir-mais':
        folhaMais.showModal();
        return;
      case 'fechar-mais':
        folhaMais.close();
        return;
    }

    // Um link escolhido dentro da folha "Mais" fecha a folha.
    if (folhaMais.open && folhaMais.contains(alvo)) folhaMais.close();
  });

  // Tocar fora da folha (no véu) também fecha.
  folhaMais.addEventListener('click', (evento) => {
    if (evento.target === folhaMais) folhaMais.close();
  });

  document.addEventListener('submit', (evento) => {
    const form = evento.target.closest('[data-form="ava-teste"]');
    if (!form) return;
    evento.preventDefault();
    enviarTesteAva(form);
  });
}
