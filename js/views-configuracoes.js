// Tela Configurações: tema (agora) e conexão com o AVA (Etapa 3).

import { cabecalho, emConstrucao } from './componentes.js';
import { icone } from './icones.js';
import { OPCOES_TEMA, lerPreferenciaTema } from './tema.js';
import { esc } from './utilidades.js';

export function renderConfiguracoes() {
  const atual = lerPreferenciaTema();
  const opcoes = OPCOES_TEMA.map((o) => `
    <button class="opcao-tema" type="button" data-tema-opcao="${o.id}" aria-pressed="${o.id === atual}">
      ${icone(o.id)}
      <span>${esc(o.rotulo)}<small>${esc(o.descricao)}</small></span>
    </button>`).join('');

  return `
    ${cabecalho('Configurações', 'Ajustes deste aparelho')}
    <div class="pilha">
      <section class="card" aria-labelledby="config-tema">
        <h2 class="card-titulo" id="config-tema">Aparência</h2>
        <p class="texto-suave">A escolha fica salva neste aparelho.</p>
        <div class="opcoes-tema">${opcoes}</div>
      </section>
      ${emConstrucao({
        icone: 'faculdade',
        titulo: 'Conectar o AVA',
        texto: 'Aqui você vai digitar a matrícula e a senha uma única vez. O app guarda só o token de acesso, criptografado, e descarta a senha.',
        etapa: '3',
      })}
    </div>`;
}
