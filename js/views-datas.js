// Datas especiais fora do Calendário: o card de Configurações → Calendário e o card "Datas que vêm aí"
// do Conteúdo (Trabalho), com as clientes de cada data.

import { esc } from './utilidades.js';
import { datasEntre, datasVisiveis, prefsDatas, clientesDaData, ehGeral, AREAS } from './datas-especiais.js';
import { clientesAtivos } from './dados-trabalho.js';

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtDia = (chave) => fmt.format(new Date(`${chave}T12:00:00`));
const clientesDaSaude = (estado) => clientesAtivos(estado).filter((c) => c.casa !== 'minha');
const somar = (chave, n) => { const d = new Date(`${chave}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const OPCOES = [
  ['feriados', 'Feriados nacionais (com o nome)'],
  ['goias', 'Feriados de Goiás'],
  ['anapolis', 'Feriados de Anápolis'],
  ['profissoes', 'Dias das profissões (do médico, do dentista…)'],
  ['saude', 'Datas da saúde (mundiais e nacionais)'],
  ['campanhas', 'Campanhas do mês (Outubro Rosa…)'],
  ['aniversarios', 'Aniversários das Pessoas (Meu cantinho)'],
];

export function cardDatasConfig(estado) {
  const p = prefsDatas(estado.config);
  const hoje = new Date().toISOString().slice(0, 10);
  const ano = hoje.slice(0, 4);
  const clientes = clientesDaSaude(estado);
  const todas = datasEntre(`${ano}-01-01`, `${ano}-12-31`).filter((d) => d.grupo !== 'feriados');
  return `
    <section class="card" id="config-calendario" aria-labelledby="titulo-config-calendario">
      <h2 class="card-titulo" id="titulo-config-calendario">Calendário: datas especiais</h2>
      <p class="texto-suave">Feriados com o nome e as datas da saúde para os posts das clientes. A Bússola calcula todo ano; nada fica guardado.</p>
      <fieldset class="rel-slides"><legend class="campo-rotulo">Mostrar no Calendário</legend>
        ${OPCOES.map(([id, nome]) => `<label class="rel-slide-opcao"><input type="checkbox" data-acao-mudar="datas-pref" value="${id}"${p[id] ? ' checked' : ''}><span>${esc(nome)}</span></label>`).join('')}
      </fieldset>
      <label class="rel-slide-opcao"><input type="checkbox" data-acao-mudar="datas-pref" value="soDasClientes"${p.soDasClientes ? ' checked' : ''}><span>Só as datas das áreas das minhas clientes</span></label>
      <div class="cal-form-linha">
        <label class="rel-slide-opcao"><input type="checkbox" data-acao-mudar="datas-pref" value="avisar"${p.avisar ? ' checked' : ''}><span>Avisar das datas das clientes</span></label>
        <label class="campo"><span class="campo-rotulo">Com antecedência de</span>
          <select data-acao-mudar="datas-antecedencia">${[7, 10, 15, 21, 30].map((n) => `<option value="${n}"${Number(p.antecedencia) === n ? ' selected' : ''}>${n} dias</option>`).join('')}</select></label>
      </div>
      <p class="campo-ajuda">O aviso chega de manhã ${esc(String(p.antecedencia))} dias antes (para dar tempo de produzir o post) e no dia, junto com o resumo da manhã. Os aniversários avisam na véspera e no dia.</p>
      <details class="detalhes"><summary>Ver as datas da saúde de ${esc(ano)} (${todas.length})</summary>
        <ul class="lista-simples datas-lista">${todas.map((d) => {
          const cli = clientesDaData(d, clientes);
          return `<li><b>${esc(fmtDia(d.data))}</b> ${esc(d.titulo)}<small>${esc(cli.length ? cli.map((c) => c.nome).join(', ') : ehGeral(d) ? 'geral da saúde' : (d.areas || []).map((a) => AREAS[a]).filter(Boolean).join(', '))}${d.conferir ? ` · conferir: ${esc(d.conferir)}` : ''}</small></li>`;
        }).join('')}</ul>
      </details>
    </section>`;
}

// "Datas que vêm aí" no Conteúdo: as datas das clientes nos próximos 30 dias.
export function cardDatasConteudo(estado, hoje) {
  const clientes = clientesDaSaude(estado);
  const datas = datasVisiveis(hoje, somar(hoje, 30), { ...prefsDatas(estado.config), feriados: false, soDasClientes: true }, clientes).slice(0, 6);
  if (!datas.length) return '';
  return `<section class="card tb-datas" aria-label="Datas que vêm aí">
    <p class="tb-rot">Datas que vêm aí · 30 dias</p>
    <ul class="lista-simples datas-lista">${datas.map((d) => `<li><b>${esc(fmtDia(d.data))}</b> ${esc(d.titulo)}<small>${esc(clientesDaData(d, clientes).map((c) => c.nome).join(', '))}</small></li>`).join('')}</ul>
  </section>`;
}
