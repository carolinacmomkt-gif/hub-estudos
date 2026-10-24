// Cliques, formulários e interações globais (delegação no documento).

import { definirTema } from './tema.js';
import { definirTamanhoTexto } from './preferencias.js';
import { obterEstado, atualizarEstado } from './estado.js';
import { enviarCodigo, confirmarCodigo, sair } from './nuvem.js';
import {
  salvar, obter, sincronizar, situacaoSincronizacao, exportarBackup, importarBackup, apagarDadosLocais,
} from './persistencia.js';
import { conectarAva, conectarLyceum, desconectar } from './funcoes.js';
import { renderCarregando, renderResultadoAva, renderResultadoLyceum } from './views-configuracoes.js';
import { renderFolhaCriar } from './views-criar.js';
import { esc } from './utilidades.js';

let app; // { renderizar, mostrarLogin, entrarNoApp }

function avisoCurto(texto) {
  const aviso = document.getElementById('aviso');
  aviso.innerHTML = `<span>${esc(texto)}</span>`;
  aviso.hidden = false;
  clearTimeout(avisoCurto.tempo);
  avisoCurto.tempo = setTimeout(() => {
    aviso.hidden = true;
  }, 3500);
}

// Marca a tela como ocupada durante uma operação, para ela não ser redesenhada no meio.
async function ocupado(fn) {
  atualizarEstado({ ocupado: true });
  try {
    return await fn();
  } finally {
    atualizarEstado({ ocupado: false });
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

async function pedirCodigo(email, botao) {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    app.mostrarLogin({ email, erro: 'Confira o e-mail digitado.' });
    return;
  }
  if (botao) botao.disabled = true;
  try {
    await enviarCodigo(email);
    app.mostrarLogin({ etapa: 'codigo', email });
  } catch (erro) {
    app.mostrarLogin({ email, erro: erro.message });
  }
}

async function entrarComCodigo(form) {
  const email = form.elements.email.value;
  const codigo = form.elements.codigo.value.replace(/\D/g, '');
  if (codigo.length < 6) {
    app.mostrarLogin({ etapa: 'codigo', email, erro: 'Digite o código que chegou no e-mail.' });
    return;
  }
  form.querySelector('[type="submit"]').disabled = true;
  try {
    await confirmarCodigo(email, codigo);
    await app.entrarNoApp();
    sincronizar();
  } catch (erro) {
    app.mostrarLogin({ etapa: 'codigo', email, erro: erro.message });
  }
}

async function sairDaConta() {
  const s = situacaoSincronizacao();
  if (s.pendentes && s.online) await sincronizar();
  const depois = situacaoSincronizacao();
  const aviso = depois.pendentes
    ? `Ainda há ${depois.pendentes} mudança(s) que não subiram para a nuvem. Se sair agora, elas se perdem. Exporte um backup antes. Sair mesmo assim?`
    : 'Sair da conta? Os dados saem deste aparelho, mas continuam guardados na nuvem.';
  if (!window.confirm(aviso)) return;
  await sair();
  await apagarDadosLocais();
  atualizarEstado({ caixa: [], conexoes: [], email: null });
  app.mostrarLogin({ mensagem: 'Você saiu da conta.' });
}

// ---------------------------------------------------------------------------
// AVA e Lyceum
// ---------------------------------------------------------------------------

async function conectarServico(form, servico) {
  const botao = form.querySelector('[type="submit"]');
  const saida = document.getElementById(`resultado-${servico}`);
  const matricula = form.elements.matricula.value.trim();
  const senha = form.elements.senha.value;
  const renderResultado = servico === 'ava' ? renderResultadoAva : renderResultadoLyceum;

  if (!matricula || !senha) {
    saida.innerHTML = renderResultado({ ok: false, erro: 'Preencha a matrícula e a senha.' });
    return;
  }

  botao.disabled = true;
  saida.innerHTML = renderCarregando(servico === 'ava' ? 'Falando com o AVA… isso leva alguns segundos.' : 'Falando com o Lyceum… isso leva alguns segundos.');
  let resultado;
  try {
    resultado = await ocupado(() => (servico === 'ava' ? conectarAva(matricula, senha) : conectarLyceum(matricula, senha)));
  } finally {
    // A senha não fica na tela depois da tentativa.
    form.elements.senha.value = '';
    botao.disabled = false;
  }

  if (resultado.ok) {
    await sincronizar(); // traz a nova situação da conexão
    app.renderizar();
  }
  const novaSaida = document.getElementById(`resultado-${servico}`);
  novaSaida.innerHTML = renderResultado(resultado);
  novaSaida.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function desconectarServico(servico) {
  const nome = servico === 'ava' ? 'o AVA' : 'o Lyceum';
  const extra = servico === 'lyceum' ? ' A senha guardada é apagada.' : ' O acesso guardado é apagado.';
  if (!window.confirm(`Desconectar ${nome}?${extra} Para voltar, é só conectar de novo.`)) return;
  const resultado = await ocupado(() => desconectar(servico));
  if (!resultado.ok) {
    avisoCurto(resultado.erro || 'Não foi possível desconectar agora.');
    return;
  }
  await sincronizar();
  app.renderizar();
  avisoCurto(`${servico === 'ava' ? 'AVA' : 'Lyceum'} desconectado.`);
}

// ---------------------------------------------------------------------------
// Caixa de entrada e backup
// ---------------------------------------------------------------------------

async function guardarIdeia(form) {
  const texto = form.elements.texto.value.trim();
  if (!texto) {
    form.elements.texto.focus();
    return;
  }
  await salvar('caixa_entrada', { texto });
  form.reset();
  document.getElementById('folha-criar').close();
  avisoCurto('Ideia guardada na caixa de entrada.');
}

async function marcarEntradaFeita(id) {
  const item = await obter('caixa_entrada', id);
  if (item) await salvar('caixa_entrada', { ...item, processado_em: new Date().toISOString() });
}

async function fazerBackup() {
  const saida = document.getElementById('backup-resultado');
  try {
    const total = await exportarBackup();
    saida.innerHTML = `<p class="ava-status">Backup exportado com ${total} ${total === 1 ? 'registro' : 'registros'}.</p>`;
  } catch {
    saida.innerHTML = '<div class="ava-alerta" role="alert">Não foi possível exportar o backup.</div>';
  }
}

async function restaurarBackup(input) {
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  const saida = document.getElementById('backup-resultado');
  if (!window.confirm('Importar este backup? Ele se junta aos dados atuais (o que tiver o mesmo registro é substituído pelo do backup).')) return;
  try {
    const total = await importarBackup(arquivo);
    saida.innerHTML = `<p class="ava-status">Backup importado: ${total} ${total === 1 ? 'registro' : 'registros'}. Sincronizando com a nuvem…</p>`;
  } catch (erro) {
    saida.innerHTML = `<div class="ava-alerta" role="alert">${esc(erro.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------

export function ligarEventos(funcoesDoApp) {
  app = funcoesDoApp;
  const folhaMais = document.getElementById('folha-mais');
  const folhaCriar = document.getElementById('folha-criar');

  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest('[data-tema-opcao], [data-texto-opcao], [data-acao], a[href^="#"]');
    if (!alvo || alvo.matches('input[type="file"]')) return;

    if (alvo.dataset.temaOpcao) {
      definirTema(alvo.dataset.temaOpcao);
      return;
    }
    if (alvo.dataset.textoOpcao) {
      definirTamanhoTexto(alvo.dataset.textoOpcao);
      return;
    }

    switch (alvo.dataset.acao) {
      case 'abrir-mais':
        folhaMais.showModal();
        return;
      case 'fechar-mais':
        folhaMais.close();
        return;
      case 'abrir-criar':
        document.getElementById('folha-criar-conteudo').innerHTML = renderFolhaCriar();
        folhaCriar.showModal();
        folhaCriar.querySelector('textarea')?.focus();
        return;
      case 'fechar-criar':
        folhaCriar.close();
        return;
      case 'sincronizar':
        sincronizar();
        return;
      case 'exportar-backup':
        fazerBackup();
        return;
      case 'sair':
        sairDaConta();
        return;
      case 'mostrar-reconectar': {
        const bloco = document.getElementById(`reconectar-${alvo.dataset.servico}`);
        bloco.hidden = !bloco.hidden;
        if (!bloco.hidden) bloco.querySelector('input')?.focus();
        return;
      }
      case 'desconectar':
        desconectarServico(alvo.dataset.servico);
        return;
      case 'entrada-feita':
        marcarEntradaFeita(alvo.dataset.id);
        return;
      case 'login-reenviar':
        pedirCodigo(alvo.dataset.email, alvo);
        return;
      case 'login-trocar-email':
        app.mostrarLogin({ email: obterEstado().email || '' });
        return;
    }

    // Um link escolhido dentro da folha "Mais" fecha a folha.
    if (folhaMais.open && folhaMais.contains(alvo)) folhaMais.close();
  });

  // Tocar fora da folha (no véu) também fecha.
  for (const folha of [folhaMais, folhaCriar]) {
    folha.addEventListener('click', (evento) => {
      if (evento.target === folha) folha.close();
    });
  }

  document.addEventListener('change', (evento) => {
    if (evento.target.matches('[data-acao="importar-backup"]')) restaurarBackup(evento.target);
  });

  document.addEventListener('submit', (evento) => {
    const form = evento.target.closest('[data-form]');
    if (!form) return;
    evento.preventDefault();
    switch (form.dataset.form) {
      case 'login-email':
        pedirCodigo(form.elements.email.value.trim(), form.querySelector('[type="submit"]'));
        break;
      case 'login-codigo':
        entrarComCodigo(form);
        break;
      case 'caixa-entrada':
        guardarIdeia(form);
        break;
      case 'conectar-ava':
        conectarServico(form, 'ava');
        break;
      case 'conectar-lyceum':
        conectarServico(form, 'lyceum');
        break;
    }
  });
}
