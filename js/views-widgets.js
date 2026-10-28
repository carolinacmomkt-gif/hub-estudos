// Configurações → Widgets do iPhone: o código só de leitura, os widgets que a Carol monta
// (área, paleta, modo e cores próprias) com a prévia no estilo vidro, e o "Parâmetro" de cada um.
// As cores da prévia vêm da paleta do widget (dados-widgets.js), não do tema do app.

import { esc } from './utilidades.js';
import { icone } from './icones.js';
import { AREAS_WIDGET, PALETAS_WIDGET, MODOS_WIDGET, coresDoWidget, widgetsDaConfig, parametroDoNome } from './dados-widgets.js';

const ICONE_AREA = { hoje: 'inicio', tarefas: 'tarefas', agenda: 'calendario', demandas: 'tarefas', habitos: 'habitos', financas: 'financas', faculdade: 'faculdade', metas: 'metas', foco: 'foco', frase: 'editar', youtube: 'youtube', substack: 'substack', leituras: 'biblioteca' };

// Um exemplo do que cada área mostra (só para a prévia).
const EXEMPLO = {
  hoje: ['5', 'tarefas para hoje', 'Reunião Sensus · 15:00'],
  tarefas: ['3', 'tarefas para hoje', 'Mandar o orçamento'],
  agenda: ['15:00', 'Dentista', 'qui · mais 2 amanhã'],
  demandas: ['4', 'demandas · 1 p/ aprovar', 'Mandar para a Dra. Karyne aprovar'],
  habitos: ['2/5', 'hábitos hoje', 'Beber água 3/8'],
  financas: ['R$ 1.240', 'dá para gastar', 'R$ 62 por dia'],
  faculdade: ['3', 'dias para a prova', 'Estatística: precisa 7,5'],
  metas: ['64%', 'Viagem de julho', 'R$ 3.200 de R$ 5.000'],
  foco: ['45', 'min de foco hoje', '6,5h na semana'],
  frase: ['“', 'A vida só é possível reinventada.', 'Cecília Meireles'],
  youtube: ['Roteiro', 'Rotina de provas', 'publica sex 31/10'],
  substack: ['1/4', 'textos no mês', 'Próximo: Posicionamento'],
  leituras: ['2', 'lendo agora', 'Pesquisa qualitativa'],
};

const rgba = ([hex, a]) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
const estiloDe = (c) => `--wf1:${c.fundo[0]};--wf2:${c.fundo[1]};--wt:${c.texto};--ws:${c.suave};--wd:${c.destaque};--wv:${rgba(c.vidro)};--wb:${rgba(c.borda)};--wa:${c.alerta}`;

// Prévia (tamanho pequeno ou médio) numa versão (claro ou escuro).
export function previaWidget(w, versao = 'escuro', { medio = false } = {}) {
  const cores = coresDoWidget(w)[versao];
  const area = AREAS_WIDGET.find((a) => a.id === w.area) || AREAS_WIDGET[0];
  const [grande, linha, rodape] = EXEMPLO[area.id];
  return `
    <div class="wprev${medio ? ' wprev-medio' : ''}" style="${esc(estiloDe(cores))}" aria-hidden="true">
      <div class="wprev-topo"><span class="wprev-icone">${icone(ICONE_AREA[area.id] || 'inicio')}</span>${esc(area.nome)}</div>
      <div class="wprev-corpo">
        <div class="wprev-numero">${esc(grande)}</div>
        <div class="wprev-linha">${esc(linha)}</div>
      </div>
      <div class="wprev-vidro">${esc(rodape)}</div>
    </div>`;
}

function itemWidget(w) {
  return `
    <li class="widget-item">
      <div class="widget-previas">${previaWidget(w, 'claro')}${previaWidget(w, 'escuro')}</div>
      <div class="widget-info">
        <strong>${esc(w.nome)}</strong>
        <span class="campo-ajuda">${esc(AREAS_WIDGET.find((a) => a.id === w.area)?.nome || '')} · ${esc(w.paleta === 'propria' ? 'cores próprias' : PALETAS_WIDGET.find((p) => p.id === w.paleta)?.nome || '')} · ${esc(MODOS_WIDGET.find((m) => m.id === w.modo)?.nome || '')}</span>
        <span class="widget-parametro">Parâmetro: <code>${esc(w.parametro)}</code>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="widget-copiar-parametro" data-parametro="${esc(w.parametro)}">Copiar</button></span>
        <span class="acoes">
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="widget-editar" data-parametro="${esc(w.parametro)}">Editar</button>
          <button class="botao botao-secundario botao-pequeno" type="button" data-acao="widget-excluir" data-parametro="${esc(w.parametro)}">Excluir</button>
        </span>
      </div>
    </li>`;
}

export function cardWidgets(estado) {
  const ligado = (estado.config || []).find((c) => c.chave === 'widget' && !c.excluido_em && c.valor?.hash);
  const codigo = estado.widgetCodigo;
  const widgets = widgetsDaConfig(estado.config);
  return `
    <section class="card" aria-labelledby="config-widget" id="widget-config">
      <h2 class="card-titulo" id="config-widget">Widgets do iPhone</h2>
      <p class="texto-suave">Widgets no estilo vidro para a Tela de Início e a Tela Bloqueada, de qualquer área, nas cores que você quiser. Usa o app gratuito <strong>Scriptable</strong> e um script só para todos.</p>
      <h3 class="ava-subtitulo">1. Código do widget</h3>
      ${codigo ? `
        <div class="ava-sucesso">
          <strong>Seu código do widget</strong>
          <code class="widget-codigo">${esc(codigo)}</code>
          <span>Ele só aparece agora. Cole no Scriptable quando o script pedir. Ele só lê os resumos: não mexe em nada.</span>
        </div>
        <div class="acoes">
          <button class="botao botao-primario" type="button" data-acao="widget-copiar">Copiar o código</button>
          <button class="botao botao-secundario" type="button" data-acao="widget-copiar-endereco">Copiar o endereço do app</button>
        </div>` : ''}
      ${ligado && !codigo ? `<p class="campo-ajuda">Ligado desde ${esc(new Date(ligado.valor.criado_em || ligado.criado_em).toLocaleDateString('pt-BR'))}. Gerar outro código desliga o anterior.</p>` : ''}
      <div class="acoes">
        <button class="botao ${ligado ? 'botao-secundario' : 'botao-primario'}" type="button" data-acao="widget-gerar">${ligado ? 'Gerar outro código' : 'Gerar o código do widget'}</button>
        ${ligado ? '<button class="botao botao-secundario" type="button" data-acao="widget-desligar">Desligar os widgets</button>' : ''}
      </div>
      <h3 class="ava-subtitulo">2. Seus widgets</h3>
      ${widgets.length ? `<ul class="widget-lista">${widgets.map(itemWidget).join('')}</ul>` : '<p class="campo-ajuda">Sem widget montado ainda: com o Parâmetro vazio, o widget mostra o Hoje nas cores da Bússola. Monte quantos quiser.</p>'}
      <div class="acoes"><button class="botao botao-primario" type="button" data-acao="widget-novo">＋ Novo widget</button></div>
      <h3 class="ava-subtitulo">3. No iPhone</h3>
      <ol class="passos-ios">
        <li>No Scriptable: <strong>+</strong>, cole o script da Bússola, dê o nome <strong>Bússola</strong> e toque em <strong>▶︎</strong> para colar o endereço e o código.</li>
        <li>Na Tela de Início: segure num espaço vazio → <strong>Editar</strong> → <strong>Adicionar widget</strong> → <strong>Scriptable</strong> → escolha o tamanho.</li>
        <li>Toque no widget novo: em <strong>Script</strong>, escolha Bússola; em <strong>Parâmetro</strong>, cole o do widget.</li>
        <li>Para o vidro de verdade do iOS 26: Editar → <strong>Personalizar</strong> → <strong>Claro</strong> (Clear).</li>
      </ol>
      <h3 class="ava-subtitulo">4. No Mac mini</h3>
      <p class="campo-ajuda">O Mac mostra os widgets do iPhone na mesa (macOS Sonoma ou mais novo, mesmo Apple ID, iPhone por perto ou na mesma rede): <strong>Ajustes do Sistema</strong> → <strong>Mesa e Dock</strong> → ligue <strong>Usar widgets do iPhone</strong>. Depois, botão direito na mesa → <strong>Editar widgets</strong> → <strong>Scriptable</strong> (do iPhone) e escolha o Parâmetro do mesmo jeito.</p>
    </section>`;
}

// Montar ou editar um widget, com a prévia clara e escura mudando na hora.
export function formWidget(w = {}) {
  const atual = { nome: '', area: 'hoje', paleta: 'bussola', modo: 'auto', cores: { fundo: '#2A2420', texto: '#F7F2EC', destaque: '#E3C9AE' }, ...w };
  return `
    <form class="formulario widget-form" data-form="widget" data-original="${esc(w.parametro || '')}" novalidate>
      <div class="widget-form-previa" data-widget-previa>${previaWidget(atual, 'claro', { medio: true })}${previaWidget(atual, 'escuro', { medio: true })}</div>
      <label class="campo"><span class="campo-rotulo">Nome</span>
        <input name="nome" type="text" maxlength="40" required value="${esc(atual.nome)}" placeholder="Ex.: Finanças rosa" data-acao-mudar="widget-previa"></label>
      <p class="campo-ajuda">Parâmetro no iPhone: <code data-widget-parametro>${esc(parametroDoNome(atual.nome) || '…')}</code></p>
      <label class="campo"><span class="campo-rotulo">Área</span>
        <select name="area" data-acao-mudar="widget-previa">${AREAS_WIDGET.map((a) => `<option value="${a.id}"${a.id === atual.area ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select></label>
      <p class="campo-ajuda" data-widget-area-desc>${esc(AREAS_WIDGET.find((a) => a.id === atual.area)?.descricao || '')}</p>
      <fieldset class="campo dem-bases"><legend class="campo-rotulo">Cores</legend>
        <div class="widget-paletas">
          ${PALETAS_WIDGET.map((p) => `
            <label class="widget-paleta">
              <input type="radio" name="paleta" value="${p.id}"${p.id === atual.paleta ? ' checked' : ''} data-acao-mudar="widget-previa">
              <span class="widget-amostra" style="background: linear-gradient(135deg, ${p.claro.fundo[0]} 0 50%, ${p.escuro.fundo[0]} 50% 100%)"><i style="background:${p.escuro.destaque}"></i></span>
              <span>${esc(p.nome)}</span>
            </label>`).join('')}
          <label class="widget-paleta">
            <input type="radio" name="paleta" value="propria"${atual.paleta === 'propria' ? ' checked' : ''} data-acao-mudar="widget-previa">
            <span class="widget-amostra widget-amostra-propria" aria-hidden="true">＋</span>
            <span>Minhas cores</span>
          </label>
        </div>
      </fieldset>
      <div class="widget-proprias" data-widget-proprias${atual.paleta === 'propria' ? '' : ' hidden'}>
        <label class="campo campo-cor"><span class="campo-rotulo">Fundo</span><input name="cor-fundo" type="color" value="${esc(atual.cores.fundo)}" data-acao-mudar="widget-previa"></label>
        <label class="campo campo-cor"><span class="campo-rotulo">Texto</span><input name="cor-texto" type="color" value="${esc(atual.cores.texto)}" data-acao-mudar="widget-previa"></label>
        <label class="campo campo-cor"><span class="campo-rotulo">Destaque</span><input name="cor-destaque" type="color" value="${esc(atual.cores.destaque)}" data-acao-mudar="widget-previa"></label>
        <p class="campo-ajuda">Se o texto ficar difícil de ler no fundo, a Bússola troca por um que dê contraste.</p>
      </div>
      <fieldset class="campo dem-bases"><legend class="campo-rotulo">Claro ou escuro</legend>
        <div class="segmentado" role="radiogroup">
          ${MODOS_WIDGET.map((m) => `<label><input type="radio" name="modo" value="${m.id}"${m.id === atual.modo ? ' checked' : ''} data-acao-mudar="widget-previa"><span>${esc(m.nome)}</span></label>`).join('')}
        </div>
      </fieldset>
      <p class="ava-alerta" role="alert" data-erro hidden></p>
      <div class="acoes">
        <button class="botao botao-primario" type="submit">Salvar o widget</button>
      </div>
    </form>`;
}

// Lê o formulário (para a prévia e para salvar).
export function widgetDoForm(form) {
  const f = new FormData(form);
  return {
    nome: String(f.get('nome') || '').trim().slice(0, 40),
    area: String(f.get('area') || 'hoje'),
    paleta: String(f.get('paleta') || 'bussola'),
    modo: String(f.get('modo') || 'auto'),
    cores: { fundo: f.get('cor-fundo') || '#2A2420', texto: f.get('cor-texto') || '#F7F2EC', destaque: f.get('cor-destaque') || '#E3C9AE' },
  };
}
