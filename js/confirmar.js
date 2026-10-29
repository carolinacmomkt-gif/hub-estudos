// Confirmar e perguntar do jeito do app: uma folha que sobe (celular e tablet) ou um cartão no
// meio (computador), no lugar do window.confirm e do window.prompt do navegador, que travam a
// tela, ficam fora do tema e não funcionam bem no app instalado.
//
// confirmar(texto, { titulo, botao, perigo }) → Promise<boolean>
// perguntarTexto(rotulo, { padrao, titulo, maximo }) → Promise<string | null>
//
// Os dois se instalam por cima de window.confirm e window.prompt: o código antigo continua
// escrevendo `if (window.confirm(...))`, só que de forma assíncrona (por isso o ligarConfirmar()
// troca as funções e quem chama de forma síncrona recebe uma Promise; os cliques do app já
// esperam Promises, ver eventos.js).

let folha = null;
let pendente = null; // { resolver } da pergunta aberta

const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function montar() {
  if (folha) return folha;
  folha = document.createElement('dialog');
  folha.className = 'folha folha-confirmar';
  folha.id = 'folha-confirmar';
  folha.setAttribute('aria-labelledby', 'confirmar-titulo');
  folha.innerHTML = `
    <div class="folha-alca" aria-hidden="true"></div>
    <form method="dialog" class="confirmar-corpo" novalidate>
      <h2 class="folha-titulo" id="confirmar-titulo"></h2>
      <p class="confirmar-texto" id="confirmar-texto"></p>
      <label class="campo confirmar-campo" id="confirmar-campo" hidden>
        <span class="campo-rotulo" id="confirmar-rotulo"></span>
        <input id="confirmar-entrada" type="text" autocomplete="off" enterkeyhint="done">
      </label>
      <div class="acoes confirmar-acoes">
        <button class="botao botao-secundario" type="button" value="nao" data-confirmar="nao">Cancelar</button>
        <button class="botao botao-primario" type="submit" value="sim" data-confirmar="sim">Confirmar</button>
      </div>
    </form>`;
  document.body.append(folha);
  folha.addEventListener('close', () => {
    const p = pendente;
    pendente = null;
    if (!p) return;
    const sim = folha.returnValue === 'sim';
    if (p.texto) p.resolver(sim ? folha.querySelector('#confirmar-entrada').value : null);
    else p.resolver(sim);
    folha.returnValue = '';
  });
  folha.addEventListener('click', (e) => {
    if (e.target.dataset?.confirmar === 'nao') fecharCom('nao');
    // Tocar no véu cancela.
    if (e.target === folha) {
      const r = folha.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fecharCom('nao');
    }
  });
  folha.addEventListener('cancel', (e) => { e.preventDefault(); fecharCom('nao'); });
  return folha;
}

function fecharCom(valor) {
  if (!folha?.open) return;
  folha.returnValue = valor;
  if (reduzido()) { folha.close(valor); return; }
  folha.classList.add('fechando');
  setTimeout(() => { folha.classList.remove('fechando'); folha.close(valor); }, 160);
}

function abrir({ titulo, texto, botao, perigo, campo = null }) {
  const f = montar();
  // Uma pergunta por vez: a anterior responde "não".
  if (f.open) { f.returnValue = 'nao'; f.close('nao'); }
  f.querySelector('#confirmar-titulo').textContent = titulo;
  f.querySelector('#confirmar-texto').textContent = texto;
  f.querySelector('#confirmar-texto').hidden = !texto;
  const sim = f.querySelector('[data-confirmar="sim"]');
  sim.textContent = botao;
  sim.classList.toggle('botao-perigo', Boolean(perigo));
  sim.classList.toggle('botao-primario', !perigo);
  const caixa = f.querySelector('#confirmar-campo');
  const entrada = f.querySelector('#confirmar-entrada');
  caixa.hidden = !campo;
  if (campo) {
    f.querySelector('#confirmar-rotulo').textContent = campo.rotulo;
    entrada.value = campo.padrao || '';
    entrada.maxLength = campo.maximo || 120;
  }
  return new Promise((resolver) => {
    pendente = { resolver, texto: Boolean(campo) };
    f.showModal();
    if (campo) { entrada.focus(); entrada.select(); } else sim.focus();
  });
}

// "Excluir o caderno?" → true/false. Texto do botão e tom de perigo vêm do que se pede.
export function confirmar(texto, { titulo = '', botao = '', perigo = null } = {}) {
  const { t, corpo } = separar(texto, titulo);
  const parecePerigo = perigo ?? /\b(exclu|apag|remov|desist|descart|sair|desconect|deslig|lixeira|perd)/i.test(t + corpo);
  const rotulo = botao || botaoDoTexto(t) || (parecePerigo ? 'Sim, pode' : 'Confirmar');
  return abrir({ titulo: t, texto: corpo, botao: rotulo, perigo: parecePerigo });
}

export function perguntarTexto(rotulo, { padrao = '', titulo = '', maximo = 120 } = {}) {
  return abrir({ titulo: titulo || rotulo, texto: '', botao: 'Salvar', perigo: false, campo: { rotulo: titulo ? rotulo : '', padrao, maximo } });
}

// Primeira frase (até o "?") vira o título; o resto, a explicação.
function separar(texto, titulo) {
  const t = String(texto || '').trim();
  if (titulo) return { t: titulo, corpo: t };
  const m = t.match(/^(.*?\?)\s*([\s\S]*)$/);
  if (m && m[1].length <= 110) return { t: m[1], corpo: m[2].trim() };
  return { t: t.length <= 80 ? t : 'Confirmar', corpo: t.length <= 80 ? '' : t };
}

// "Excluir X?" → "Excluir"; "Mandar para a lixeira?" → "Mandar para a lixeira"; senão nada.
function botaoDoTexto(t) {
  const m = t.match(/^(Excluir|Apagar de vez|Apagar|Remover|Desistir|Descartar|Sair|Desconectar|Desligar|Encerrar|Esconder|Limpar|Juntar|Restaurar|Importar|Tirar|Trocar|Terminar|Gerar outro código|Mandar(?: \w+)*? para a lixeira|Voltar o Hoje ao padrão|Conectar)\b/i);
  if (!m) return '';
  const base = m[0].replace(/\s+\w+ para a lixeira$/, ' para a lixeira');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Troca os diálogos do navegador pelos do app (uma vez, no início).
export function ligarConfirmar() {
  window.confirm = (texto) => confirmar(texto);
  window.prompt = (rotulo, padrao = '') => perguntarTexto(rotulo, { padrao });
  // alert vira o aviso curto, quando o app tiver um; até lá, uma folha só com "Entendi".
  window.alert = (texto) => abrir({ titulo: String(texto || ''), texto: '', botao: 'Entendi', perigo: false }).then(() => undefined);
}

export const confirmacaoAberta = () => Boolean(folha?.open);
export { esc as _escConfirmar };
