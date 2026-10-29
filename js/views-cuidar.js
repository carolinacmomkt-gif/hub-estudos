// Telas da parte 2 do Meu cantinho: Cuidar de mim (#cantinho/cuidar), Lista de desejos
// (#cantinho/desejos) e Pessoas (#cantinho/pessoas). Mesmo visual do cantinho (ct-*).

import { esc } from './utilidades.js';
import { habitosDoDia, valorNoDia, metaDe } from './dados-habitos.js';
import {
  cuidarDe, remediosDeHoje, consultasProximas, consultasPassadas, textoQuando, exameVencendo, peleDeHoje, resumoCuidar,
  lerCiclo, infoCiclo, textoDias, NOMES_DIA_CURTO, PERIODOS_PELE,
} from './dados-cuidar.js';
import { listaDesejosDe, desejosAbertos, desejosRealizados, textoEsperando } from './dados-desejos.js';
import { pessoasDe, aniversariosProximos, paraFalar, textoFaltam, textoContato, textoAniversario, proximoAniversario, OPCOES_LEMBRAR, amanha } from './dados-pessoas.js';

const fmtLonga = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
const dataLonga = (iso) => fmtLonga.format(new Date(`${iso}T12:00:00`));

export function habitoAgua(estado, hoje) {
  const h = habitosDoDia(estado.habitos || [], estado.habitoRegistros || [], hoje).lista.find((x) => /água/i.test(x.nome));
  if (!h) return null;
  return { habito: h, valor: valorNoDia(estado.habitoRegistros || [], h, hoje), meta: Math.max(1, metaDe(h)), unidade: h.unidade || 'copos' };
}

const diasCampo = (nome, marcados = []) => `<div class="ct-dias">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="ct-dia"><input type="checkbox" name="${nome}" value="${d}"${marcados.length === 0 || marcados.includes(d) ? ' checked' : ''}><span>${NOMES_DIA_CURTO[d]}</span></label>`).join('')}</div>`;

const botaoCheck = (acao, dados, feito, rotulo) => `<button class="ct-check${feito ? ' on' : ''}" type="button" data-acao="${acao}" ${dados} aria-pressed="${feito}" aria-label="${esc(rotulo)}">${feito ? '✓' : ''}</button>`;
const botaoTirar = (acao, id, rotulo) => `<button class="ct-tirar" type="button" data-acao="${acao}" data-id="${esc(id)}" aria-label="Tirar ${esc(rotulo)}" title="Tirar">×</button>`;

// ---------------------------------------------------------------------------
// Cuidar de mim
// ---------------------------------------------------------------------------

export function telaCuidar(estado, topo, hoje) {
  const cuidar = cuidarDe(estado.config);
  const agua = habitoAgua(estado, hoje);
  const r = resumoCuidar(cuidar, hoje, agua);
  const sub = r.total ? `Hoje: ${r.feitos} de ${r.total}.` : 'Água, remédios, consultas, ciclo e pele. Tudo seu, nada de trabalho.';
  return `
    ${topo('Cuidar de mim', { voltar: true, sub })}
    <div class="ct-grade">
      ${cardAgua(agua)}
      ${cardRemedios(cuidar, hoje)}
      ${cardConsultas(cuidar, hoje)}
      ${cardPele(cuidar, hoje)}
      ${cardCiclo(hoje)}
    </div>`;
}

function cardAgua(agua) {
  if (!agua) {
    return `
      <section class="ct-card">
        <p class="ct-rotulo">Água</p>
        <p class="texto-suave">A água vem do hábito "Beber água". Ainda não existe: quer criar com 8 copos por dia?</p>
        <div class="acoes"><button class="botao botao-secundario" type="button" data-acao="cu-agua-criar">Criar o hábito</button></div>
      </section>`;
  }
  const total = Math.max(agua.meta, Math.min(agua.meta * 2, agua.valor));
  return `
    <section class="ct-card">
      <div class="ct-card-topo"><p class="ct-rotulo">Água</p><span class="ct-selo">${agua.valor}/${agua.meta} ${esc(agua.unidade)}</span></div>
      <div class="ct-copos" role="group" aria-label="Copos de água de hoje">${Array.from({ length: total }, (_, i) => `<button class="ct-copo${i < agua.valor ? ' cheio' : ''}" type="button" data-acao="cu-agua" data-id="${esc(agua.habito.id)}" data-valor="${i + 1}" aria-label="${i + 1} ${esc(agua.unidade)}" aria-pressed="${i < agua.valor}">💧</button>`).join('')}</div>
      <p class="campo-ajuda">${agua.valor >= agua.meta ? 'Meta de hoje batida.' : `Faltam ${agua.meta - agua.valor}. Toque no copo que você acabou de beber.`}</p>
    </section>`;
}

function cardRemedios(cuidar, hoje) {
  const doses = remediosDeHoje(cuidar, hoje);
  const semHoje = (cuidar.remedios || []).filter((r) => !doses.some((d) => d.remedio.id === r.id));
  return `
    <section class="ct-card">
      <div class="ct-card-topo"><p class="ct-rotulo">Remédios e vitaminas</p>${doses.length ? `<span class="ct-selo">${doses.filter((d) => d.tomado).length}/${doses.length} hoje</span>` : ''}</div>
      ${doses.length ? `<ul class="ct-lista">${doses.map((d) => `
        <li class="ct-item${d.tomado ? ' feito' : ''}">
          ${botaoCheck('cu-remedio-tomei', `data-id="${esc(d.remedio.id)}" data-hora="${esc(d.hora)}"`, d.tomado, `${d.remedio.nome} às ${d.hora}`)}
          <span class="ct-item-texto"><b>${esc(d.remedio.nome)}</b><small>${d.hora === '--:--' ? 'sem hora' : `${esc(d.hora)} · aviso na hora`}${d.remedio.dose ? ` · ${esc(d.remedio.dose)}` : ''} · ${esc(textoDias(d.remedio.dias))}</small></span>
          ${botaoTirar('cu-remedio-remover', d.remedio.id, d.remedio.nome)}
        </li>`).join('')}</ul>` : '<p class="texto-suave">Nada para hoje.</p>'}
      ${semHoje.length ? `<p class="campo-ajuda">Outros dias: ${semHoje.map((r) => `${esc(r.nome)} (${esc(textoDias(r.dias))})`).join(' · ')}</p>` : ''}
      <details class="ct-mais">
        <summary>Adicionar remédio ou vitamina</summary>
        <form class="formulario ct-form" data-form="cu-remedio" novalidate>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Nome</span><input name="nome" type="text" maxlength="60" placeholder="Ex.: Vitamina D" required></label>
            <label class="campo"><span class="campo-rotulo">Horários</span><input name="horas" type="text" inputmode="numeric" placeholder="08:00, 21:00"></label>
          </div>
          <label class="campo"><span class="campo-rotulo">Dose (opcional)</span><input name="dose" type="text" maxlength="40" placeholder="1 comprimido"></label>
          <fieldset class="campo"><legend class="campo-rotulo">Dias</legend>${diasCampo('dias')}</fieldset>
          <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </details>
    </section>`;
}

function cardConsultas(cuidar, hoje) {
  const proximas = consultasProximas(cuidar, hoje);
  const passadas = consultasPassadas(cuidar, hoje);
  const exames = (cuidar.exames || []).map((e) => ({ exame: e, ...exameVencendo(e, hoje) }));
  return `
    <section class="ct-card">
      <p class="ct-rotulo">Consultas e exames</p>
      ${proximas.length ? `<ul class="ct-lista">${proximas.map((c) => `
        <li class="ct-item">
          <span class="ct-quando">${esc(textoQuando(c.data, hoje))}</span>
          <span class="ct-item-texto"><b>${esc(c.nome)}</b><small>${c.hora ? `${esc(c.hora)} · ` : ''}${c.local ? `${esc(c.local)} · ` : ''}${c.levar ? `levar: ${esc(c.levar)}` : 'no calendário'}</small></span>
          <span class="ct-item-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="cu-consulta-feita" data-id="${esc(c.id)}">Feita</button>${botaoTirar('cu-consulta-remover', c.id, c.nome)}</span>
        </li>`).join('')}</ul>` : '<p class="texto-suave">Nenhuma consulta marcada.</p>'}
      ${passadas.length ? `<p class="campo-ajuda">Passaram sem "feita": ${passadas.map((c) => `${esc(c.nome)} (${esc(dataLonga(c.data))}) <button class="ct-link" type="button" data-acao="cu-consulta-feita" data-id="${esc(c.id)}">foi</button>`).join(' · ')}</p>` : ''}
      <details class="ct-mais">
        <summary>Marcar consulta ou exame</summary>
        <form class="formulario ct-form" data-form="cu-consulta" novalidate>
          <label class="campo"><span class="campo-rotulo">O quê</span><input name="nome" type="text" maxlength="80" placeholder="Ex.: Dentista" required></label>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Dia</span><input name="data" type="date" required></label>
            <label class="campo"><span class="campo-rotulo">Hora</span><input name="hora" type="time"></label>
          </div>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Onde</span><input name="local" type="text" maxlength="80" placeholder="Clínica, endereço"></label>
            <label class="campo"><span class="campo-rotulo">Levar</span><input name="levar" type="text" maxlength="120" placeholder="cartão, exames anteriores"></label>
          </div>
          <div class="acoes"><button class="botao botao-primario" type="submit">Marcar (vai para o Calendário)</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </details>
      <p class="ct-rotulo ct-rotulo-meio">Exames de rotina</p>
      ${exames.length ? `<ul class="ct-lista">${exames.map((x) => `
        <li class="ct-item${x.marcar ? ' atencao' : ''}">
          <span class="ct-quando">${x.marcar ? '!' : '✓'}</span>
          <span class="ct-item-texto"><b>${esc(x.exame.nome)}</b><small>a cada ${x.exame.meses} ${x.exame.meses === 1 ? 'mês' : 'meses'}${x.exame.ultima ? ` · último em ${esc(dataLonga(x.exame.ultima))}` : ''} · ${esc(x.texto)}</small></span>
          <span class="ct-item-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="cu-exame-feito" data-id="${esc(x.exame.id)}">Fiz hoje</button>${botaoTirar('cu-exame-remover', x.exame.id, x.exame.nome)}</span>
        </li>`).join('')}</ul>` : '<p class="texto-suave">Os que repetem (check-up, dentista, ginecologista): o app avisa quando chegar a hora.</p>'}
      <details class="ct-mais">
        <summary>Adicionar exame de rotina</summary>
        <form class="formulario ct-form" data-form="cu-exame" novalidate>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Qual</span><input name="nome" type="text" maxlength="60" placeholder="Ex.: Check-up" required></label>
            <label class="campo campo-curto"><span class="campo-rotulo">A cada (meses)</span><input name="meses" type="number" min="1" max="60" value="12"></label>
          </div>
          <label class="campo"><span class="campo-rotulo">Último (se lembrar)</span><input name="ultima" type="date"></label>
          <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </details>
    </section>`;
}

function cardPele(cuidar, hoje) {
  const passos = peleDeHoje(cuidar, hoje);
  const grupo = (id) => passos.filter((p) => p.passo.periodo === id);
  return `
    <section class="ct-card">
      <div class="ct-card-topo"><p class="ct-rotulo">Rotina de pele</p>${passos.length ? `<span class="ct-selo">${passos.filter((p) => p.feito).length}/${passos.length} hoje</span>` : ''}</div>
      ${passos.length ? PERIODOS_PELE.map((per) => grupo(per.id).length ? `
        <p class="ct-subtitulo">${per.emoji} ${esc(per.nome)}</p>
        <ul class="ct-lista">${grupo(per.id).map((p) => `
          <li class="ct-item${p.feito ? ' feito' : ''}">
            ${botaoCheck('cu-pele-feito', `data-id="${esc(p.passo.id)}"`, p.feito, p.passo.nome)}
            <span class="ct-item-texto"><b>${esc(p.passo.nome)}</b><small>${esc(textoDias(p.passo.dias))}</small></span>
            ${botaoTirar('cu-pele-remover', p.passo.id, p.passo.nome)}
          </li>`).join('')}</ul>` : '').join('') : '<p class="texto-suave">Os passos de manhã e de noite, com os dias certos de cada produto (o ácido em dias alternados, por exemplo).</p>'}
      <details class="ct-mais">
        <summary>Adicionar passo</summary>
        <form class="formulario ct-form" data-form="cu-pele" novalidate>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Passo</span><input name="nome" type="text" maxlength="60" placeholder="Ex.: Protetor solar" required></label>
            <label class="campo"><span class="campo-rotulo">Quando</span><select name="periodo">${PERIODOS_PELE.map((p) => `<option value="${p.id}">${p.emoji} ${esc(p.nome)}</option>`).join('')}</select></label>
          </div>
          <fieldset class="campo"><legend class="campo-rotulo">Dias</legend>${diasCampo('dias')}</fieldset>
          <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </details>
    </section>`;
}

function cardCiclo(hoje) {
  const ciclo = lerCiclo();
  const info = ciclo ? infoCiclo(ciclo, hoje) : null;
  if (!ciclo) {
    return `
      <section class="ct-card">
        <p class="ct-rotulo">Ciclo (opcional)</p>
        <p class="texto-suave">Fica só neste aparelho: não vai para a nuvem nem para os outros aparelhos. Dia do ciclo, quando vem o próximo e quando a TPM costuma começar.</p>
        <form class="formulario ct-form" data-form="cu-ciclo" novalidate>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Primeiro dia do último</span><input name="inicio" type="date" required></label>
            <label class="campo campo-curto"><span class="campo-rotulo">Ciclo (dias)</span><input name="duracao" type="number" min="20" max="45" value="28"></label>
          </div>
          <div class="acoes"><button class="botao botao-secundario" type="submit">Acompanhar</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>`;
  }
  return `
    <section class="ct-card">
      <div class="ct-card-topo"><p class="ct-rotulo">Ciclo</p><span class="ct-selo">só neste aparelho</span></div>
      ${info ? `
        <p class="ct-destaque">Dia ${info.dia} <small>de ${info.duracao} · ${esc(info.fase)}</small></p>
        <p class="texto-suave">${info.atrasado ? 'Já passou do dia previsto. Quando vier, toque em "Começou hoje".' : `Próximo por volta de ${esc(dataLonga(info.proximo))} (${esc(textoFaltam(info.faltam))}).${info.tpmEm > 0 ? ` A TPM costuma vir uns 5 dias antes: ${esc(textoFaltam(info.tpmEm))}.` : ' Fase em que a TPM costuma aparecer.'}`}</p>`
        : '<p class="texto-suave">A data de início está no futuro. Toque em "Começou hoje" quando vier.</p>'}
      <div class="acoes">
        <button class="botao botao-primario" type="button" data-acao="cu-ciclo-hoje">Começou hoje</button>
        <button class="botao botao-secundario" type="button" data-acao="cu-ciclo-desligar">Parar de acompanhar</button>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Lista de desejos
// ---------------------------------------------------------------------------

export function telaDesejos(estado, topo) {
  const lista = listaDesejosDe(estado.config);
  const abertos = desejosAbertos(lista);
  const realizados = desejosRealizados(lista).slice(0, 8);
  return `
    ${topo('Lista de desejos', { voltar: true, sub: 'O que você gostaria de ter. Sem preço, sem pressa: o tempo mostra o que ainda faz sentido.' })}
    <div class="ct-grade">
      <section class="ct-card">
        <div class="ct-card-topo"><p class="ct-rotulo">Quero</p>${abertos.length ? `<span class="ct-selo">${abertos.length}</span>` : ''}</div>
        ${abertos.length ? `<ul class="ct-lista">${abertos.map((d) => `
          <li class="ct-item">
            <span class="ct-item-texto"><b>${esc(d.nome)}</b><small>${d.porque ? `${esc(d.porque)} · ` : ''}${esc(textoEsperando(d))}${d.link ? ` · <a class="ct-link" href="${esc(d.link)}" target="_blank" rel="noopener">abrir</a>` : ''}</small></span>
            <span class="ct-item-acoes">
              <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ds-ganhei" data-id="${esc(d.id)}">Consegui</button>
              <button class="botao botao-secundario botao-pequeno" type="button" data-acao="ds-deixei" data-id="${esc(d.id)}">Deixei para lá</button>
            </span>
          </li>`).join('')}</ul>` : '<p class="texto-suave">Nada na lista. Quando bater aquela vontade, escreve aqui e deixa descansar.</p>'}
        <form class="formulario ct-form" data-form="ds-novo" novalidate>
          <label class="campo"><span class="campo-rotulo">Quero…</span><input name="nome" type="text" maxlength="80" placeholder="Ex.: tênis de corrida" required></label>
          <div class="cal-form-linha">
            <label class="campo"><span class="campo-rotulo">Por quê (opcional)</span><input name="porque" type="text" maxlength="160" placeholder="o meu está acabado"></label>
            <label class="campo"><span class="campo-rotulo">Link (opcional)</span><input name="link" type="url" placeholder="https://"></label>
          </div>
          <div class="acoes"><button class="botao botao-primario" type="submit">Pôr na lista</button></div>
          <p class="campo-ajuda" data-erro hidden></p>
        </form>
      </section>
      ${realizados.length ? `<section class="ct-card">
        <p class="ct-rotulo">Consegui</p>
        <ul class="ct-lista">${realizados.map((d) => `<li class="ct-item feito"><span class="ct-check on" aria-hidden="true">✓</span><span class="ct-item-texto"><b>${esc(d.nome)}</b><small>${esc(new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(d.decidido_em)))}</small></span>${botaoTirar('ds-remover', d.id, d.nome)}</li>`).join('')}</ul>
      </section>` : ''}
    </div>`;
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

export function telaPessoas(estado, topo, hoje) {
  const lista = pessoasDe(estado.config);
  const proximos = aniversariosProximos(lista, hoje, 30);
  const falar = paraFalar(lista, hoje);
  return `
    ${topo('Pessoas', { voltar: true, sub: 'A sua gente: aniversários, o que cada um gosta e quem faz tempo que você não fala.' })}
    <div class="ct-grade">
      <section class="ct-card">
        <p class="ct-rotulo">Próximos aniversários</p>
        ${proximos.length ? `<ul class="ct-lista">${proximos.map((x) => `
          <li class="ct-item${x.faltam === 0 ? ' atencao' : ''}">
            <span class="ct-quando">${esc(textoFaltam(x.faltam))}</span>
            <span class="ct-item-texto"><b>${x.faltam === 0 ? '🎂 ' : ''}${esc(x.pessoa.nome)}${x.idade ? ` faz ${x.idade}` : ''}</b><small>${esc(dataLonga(x.data))}${x.pessoa.gosta ? ` · gosta de ${esc(x.pessoa.gosta)}` : ''}${x.pessoa.presentes ? ` · presente: ${esc(x.pessoa.presentes)}` : ''}</small></span>
          </li>`).join('')}</ul>` : '<p class="texto-suave">Nenhum nos próximos 30 dias.</p>'}
        ${falar.length ? `<p class="ct-rotulo ct-rotulo-meio">Faz tempo</p>
        <ul class="ct-lista">${falar.map((x) => `
          <li class="ct-item">
            <span class="ct-item-texto"><b>${esc(x.pessoa.nome)}</b><small>${esc(textoContato(x.pessoa, hoje))}</small></span>
            <span class="ct-item-acoes"><button class="botao botao-secundario botao-pequeno" type="button" data-acao="ps-falei" data-id="${esc(x.pessoa.id)}">Falei hoje</button></span>
          </li>`).join('')}</ul>` : ''}
      </section>
      <section class="ct-card">
        <div class="ct-card-topo"><p class="ct-rotulo">Todas</p>${lista.length ? `<span class="ct-selo">${lista.length}</span>` : ''}</div>
        ${lista.length ? `<ul class="ct-lista">${[...lista].sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => {
    const prox = proximoAniversario(p, hoje);
    return `
          <li class="ct-item">
            <span class="ct-item-texto"><b>${esc(p.nome)}</b><small>${p.aniversario ? `🎂 ${esc(textoAniversario(p.aniversario))}${prox ? ` (${esc(textoFaltam(prox.faltam))})` : ''}` : 'sem aniversário'}${p.gosta ? ` · gosta de ${esc(p.gosta)}` : ''}${p.lembrar ? ` · ${esc(textoContato(p, hoje))}` : ''}</small></span>
            <span class="ct-item-acoes">${p.lembrar ? `<button class="botao botao-secundario botao-pequeno" type="button" data-acao="ps-falei" data-id="${esc(p.id)}">Falei hoje</button>` : ''}${botaoTirar('ps-remover', p.id, p.nome)}</span>
          </li>`;
  }).join('')}</ul>` : '<p class="texto-suave">Ninguém ainda. Comece por quem você sempre esquece a data.</p>'}
        <details class="ct-mais"${lista.length ? '' : ' open'}>
          <summary>Adicionar pessoa</summary>
          <form class="formulario ct-form" data-form="ps-novo" novalidate>
            <div class="cal-form-linha">
              <label class="campo"><span class="campo-rotulo">Nome</span><input name="nome" type="text" maxlength="60" placeholder="Ex.: Bia" required></label>
              <label class="campo"><span class="campo-rotulo">Aniversário</span><input name="aniversario" type="text" inputmode="numeric" placeholder="DD/MM ou DD/MM/AAAA"></label>
            </div>
            <label class="campo"><span class="campo-rotulo">Gosta de</span><input name="gosta" type="text" maxlength="160" placeholder="café especial, livros de poesia"></label>
            <div class="cal-form-linha">
              <label class="campo"><span class="campo-rotulo">Ideias de presente</span><input name="presentes" type="text" maxlength="160" placeholder="caneca, vale-livro"></label>
              <label class="campo"><span class="campo-rotulo">Me lembrar de falar</span><select name="lembrar">${OPCOES_LEMBRAR.map((o) => `<option value="${o.valor}">${esc(o.nome)}</option>`).join('')}</select></label>
            </div>
            <div class="acoes"><button class="botao botao-primario" type="submit">Guardar</button></div>
            <p class="campo-ajuda" data-erro hidden></p>
          </form>
        </details>
      </section>
    </div>`;
}

// ---------------------------------------------------------------------------
// O que a entrada do cantinho mostra em cada canto
// ---------------------------------------------------------------------------

export function resumoParaCantos(estado, hoje) {
  const cuidar = cuidarDe(estado.config);
  const agua = habitoAgua(estado, hoje);
  const r = resumoCuidar(cuidar, hoje, agua);
  const pessoas = pessoasDe(estado.config);
  const prox = aniversariosProximos(pessoas, hoje, 30)[0];
  const falar = paraFalar(pessoas, hoje);
  const desejos = desejosAbertos(listaDesejosDe(estado.config));
  const consulta = r.consultas[0];
  return {
    cuidar: r.total
      ? `hoje: ${r.feitos} de ${r.total} · ${consulta && consulta.data <= amanha(hoje) ? `${consulta.nome} ${textoQuando(consulta.data, hoje)}` : agua ? `água ${agua.valor}/${agua.meta}` : 'tudo certo'}`
      : 'água, remédios, consultas, ciclo, pele',
    pessoas: prox ? `${prox.pessoa.nome}: aniversário ${textoFaltam(prox.faltam)}${falar.length ? ` · ${falar.length} para ligar` : ''}` : falar.length ? `${falar.map((x) => x.pessoa.nome).slice(0, 2).join(' e ')}: faz tempo que não fala` : 'aniversários, gostos, quem faz tempo que não fala',
    desejos: desejos.length ? `${desejos.length} ${desejos.length === 1 ? 'coisa esperando' : 'coisas esperando'} · ${desejos[0].nome}` : 'o que você gostaria de ter, sem pressa',
  };
}
