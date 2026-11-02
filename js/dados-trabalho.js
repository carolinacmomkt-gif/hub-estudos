// Grupo Trabalho (o Pauta dentro do Bússola, 01/11/2026): as contas e as regras, sem tela e sem
// internet. Usado pelo app e pelas funções da Netlify (sincronizar, avisos).
// Conteúdo = uma peça de um calendário do Notion ou de um quadro do Trello (tabela conteudos).
// Cliente = clientes_trabalho (com a ficha, a memória de feedback e a casa: Essence, Confluir ou Minha marca).

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const slug = (t) => normalizar(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "Gustavo · ficha completa" vira "Gustavo"; "Dra. Anisse | Bem-vinda" vira "Dra. Anisse".
export const nomeDoCliente = (titulo) => String(titulo || '').split(/\s+[·|]\s+/)[0].trim();
// "Dra. Karyne Magalhães | SM" e "Dr. Matheus Moreira SM" (nome do quadro do Trello) viram só o nome.
export const nomeDoQuadro = (q) => String(q || '').split('|')[0].replace(/\s+SM\s*$/i, '').trim() || String(q || '').trim();

const CABECALHO_SENSIVEL = /acesso|senha|login|credencia|contrato|financeir|pagamento/i;
const LINHA_SENSIVEL = /\b(senha|password|passcode|token|api[ _-]?key|chave de api|login|usu[aá]rio e senha|2fa|c[oó]digo de recupera)\b/i;

// Tira das fichas as seções e linhas com acessos: elas não são copiadas nem vão para a IA.
export function semAcessos(texto) {
  const saida = [];
  let pulando = 0;
  for (const linha of String(texto || '').split('\n')) {
    const t = linha.match(/^(#{1,4})\s+(.*)$/);
    if (t) {
      const nivel = t[1].length;
      if (pulando && nivel > pulando) continue;
      pulando = 0;
      if (CABECALHO_SENSIVEL.test(t[2])) { pulando = nivel; continue; }
    }
    if (pulando || LINHA_SENSIVEL.test(linha)) continue;
    saida.push(linha);
  }
  return saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const TITULOS = new Set(['dr', 'dra', 'doutor', 'doutora', 'clinica']);
const palavrasDoNome = (n) => normalizar(n).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((p) => p && !TITULOS.has(p));
const contem = (texto, trecho) => ` ${texto} `.includes(` ${trecho} `);

// De qual cliente um texto fala (nome inteiro; ou o primeiro nome, se não ficar ambíguo).
export function acharCliente(texto, clientes, soInteiro = false) {
  const alvo = palavrasDoNome(texto).join(' ');
  const ordenados = [...clientes].sort((a, b) => palavrasDoNome(b.nome).length - palavrasDoNome(a.nome).length);
  const inteiro = ordenados.find((c) => { const n = palavrasDoNome(c.nome).join(' '); return n && contem(alvo, n); });
  if (inteiro || soInteiro) return inteiro || null;
  const porPrimeiro = clientes.filter((c) => { const p = palavrasDoNome(c.nome)[0]; return p && p.length >= 4 && contem(alvo, p); });
  return porPrimeiro.length === 1 ? porPrimeiro[0] : null;
}

// A etiqueta do Trello é deste cliente? ("KARYNE MAGALHÃES" e "Dra. Karyne Magalhães")
export function etiquetaDoCliente(etiqueta, cliente) {
  const a = palavrasDoNome(etiqueta).join(' ');
  const b = palavrasDoNome(nomeDoQuadro(cliente)).join(' ');
  if (a.length < 3 || !b) return false;
  return contem(b, a) || contem(a, b);
}

// ---------------------------------------------------------------------------
// Status, grupos e com quem está cada peça
// ---------------------------------------------------------------------------

export const GRUPOS = [
  { id: 'fazer', nome: 'A fazer' },
  { id: 'producao', nome: 'Em produção' },
  { id: 'aprovacao', nome: 'Em aprovação' },
  { id: 'pronto', nome: 'Pronto' },
  { id: 'postado', nome: 'Postado' },
  { id: 'sem', nome: 'Sem status' },
];

const GRUPO_DO_STATUS = {
  'copy em desenvolvimento': 'fazer', 'video pendente': 'fazer', 'capa de reels pendente': 'fazer', 'legenda pendente': 'fazer', 'cliente enviar material': 'fazer',
  'fazer design': 'producao', 'editar video': 'producao', ajuste: 'producao', 'ajuste realizado': 'producao',
  'aprovacao interna': 'aprovacao', 'cliente aprovar': 'aprovacao', 'copy aprovada': 'aprovacao',
  aprovado: 'pronto', agendado: 'pronto', agendados: 'pronto', postado: 'postado', postados: 'postado',
  demandas: 'fazer', 'a fazer': 'fazer', planejamento: 'fazer', liberado: 'producao', anotado: 'producao', 'em andamento': 'producao',
  'em producao': 'producao', alteracao: 'producao', revisao: 'producao', aprovacao: 'aprovacao', 'em aprovacao': 'aprovacao',
  'posts para aprovacao': 'aprovacao', aprovados: 'pronto', finalizados: 'postado', concluido: 'postado', concluidos: 'postado',
};
export const grupoDoStatus = (status) => GRUPO_DO_STATUS[normalizar(status)] || 'sem';
export const nomeDoGrupo = (id) => GRUPOS.find((g) => g.id === id)?.nome || 'Sem status';

export const NOME_COM_QUEM = { voce: 'Com você', cliente: 'Com o cliente', design: 'Com o design', pronto: 'Pronto', feito: 'Postado' };
const COM_QUEM = {
  'copy em desenvolvimento': 'voce', 'video pendente': 'voce', 'capa de reels pendente': 'voce', 'legenda pendente': 'voce', 'copy aprovada': 'voce',
  'aprovacao interna': 'voce', planejamento: 'voce', demandas: 'voce', 'a fazer': 'voce', aprovado: 'voce', aprovados: 'voce', ajuste: 'voce',
  alteracao: 'voce', revisao: 'voce', 'cliente enviar material': 'cliente', 'cliente aprovar': 'cliente', aprovacao: 'cliente', 'em aprovacao': 'cliente',
  'posts para aprovacao': 'cliente', 'fazer design': 'design', 'editar video': 'design', 'ajuste realizado': 'design', liberado: 'design', anotado: 'design',
  'em andamento': 'design', 'em producao': 'design', agendado: 'pronto', postado: 'feito', finalizados: 'feito', concluido: 'feito', concluidos: 'feito',
};
export const comQuem = (status) => COM_QUEM[normalizar(status)] || 'voce';

// Para onde vai uma peça do Notion aprovada, ou que volta para ajuste (cada calendário tem suas etapas).
export function destinoDaAprovacao(opcoes) {
  for (const alvo of ['copy aprovada', 'cliente aprovar', 'aprovado', 'aprovados', 'finalizados']) {
    const achado = (opcoes || []).find((o) => normalizar(o) === alvo);
    if (achado) return achado;
  }
  return null;
}
export const destinoDoAjuste = (opcoes) => (opcoes || []).find((o) => normalizar(o) === 'ajuste')
  || (opcoes || []).find((o) => ['revisao', 'alteracao'].includes(normalizar(o))) || null;

// Informações, links, ideias e os arquivos por mês não são trabalho em andamento. As listas com nome
// de mês (JANEIRO, "Fevereiro 2026", "03 - Março") são o arquivo interno do design: nunca contam.
const MES = /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/;
export const ehListaDeMes = (lista) => MES.test(normalizar(lista));
export const listaAtiva = (lista) => !ehListaDeMes(lista) && !/^(informa|infos?\b|links?\b|ideias?\b)|^\d+ [a-z]+$|^\d{4}$|^[a-z]+ \d{2,4}$/.test(normalizar(lista));

export function formatoDasEtiquetas(etiquetas) {
  const l = (etiquetas || []).map(normalizar);
  if (l.some((e) => e.includes('reels') && !e.includes('capa'))) return 'Reels';
  if (l.some((e) => e.includes('carrossel'))) return 'Carrossel';
  if (l.some((e) => e.includes('stories'))) return 'Stories';
  if (l.some((e) => e.includes('estatico'))) return 'Estático';
  return null;
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

export const somarDias = (dia, n) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 864e5);
const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const nomeDoDia = (dia) => NOMES_DIA[new Date(`${dia}T12:00:00`).getDay()];
export const diaMes = (dia) => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`;
export function quando(dia, hoje) {
  if (!dia) return 'sem data';
  if (dia === hoje) return 'hoje';
  if (dia === somarDias(hoje, 1)) return 'amanhã';
  if (dia === somarDias(hoje, -1)) return 'ontem';
  return dia > hoje && dia < somarDias(hoje, 7) ? `${nomeDoDia(dia)}, ${Number(dia.slice(8, 10))}` : diaMes(dia);
}
// Segunda-feira da semana do dia.
export const segundaDe = (dia) => somarDias(dia, -((new Date(`${dia}T12:00:00`).getDay() + 6) % 7));

// ---------------------------------------------------------------------------
// Casas, cores e clientes
// ---------------------------------------------------------------------------

export const CASAS = [
  { id: 'essence', nome: 'Essence' },
  { id: 'confluir', nome: 'Confluir' },
  { id: 'minha', nome: 'Minha marca' },
];
const EH_MINHA = /^(carol|carol lima|portal da carol|organiza sm|essence)$/;
export const ehMinha = (nome) => EH_MINHA.test(normalizar(nome));

// Do Trello é Confluir, do Notion é Essence; a sua marca fica à parte.
export function casaDoCliente(cliente, pecas = []) {
  if (cliente.casa) return cliente.casa;
  if (ehMinha(cliente.nome)) return 'minha';
  const doTrello = pecas.filter((c) => c.origem === 'trello').length;
  if (doTrello && doTrello >= pecas.length - doTrello) return 'confluir';
  if (!pecas.length && String(cliente.url || '').includes('trello.com')) return 'confluir';
  return 'essence';
}

// Seis cores da paleta (tokens --cliente-1 a --cliente-6 em temas.css), escolhidas pelo nome.
export function corDoCliente(chave) {
  let h = 0;
  for (const ch of String(chave || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}

export const vivos = (lista) => (lista || []).filter((x) => !x.excluido_em);
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Só o que está valendo: data de 14 dias atrás em diante; sem data, mexida nos últimos 30 dias.
export function vigente(p, hoje = hojeLocal()) {
  if (p.data) return p.data >= somarDias(hoje, -14);
  const ref = p.entrega || (p.editado_em ? String(p.editado_em).slice(0, 10) : null);
  return !ref || ref >= somarDias(hoje, -30);
}
// Clientes que não são dela (Configurações → Trabalho): config "trabalho" { naoMeus: [chaves] }.
export const configTrabalho = (estado) => estado.configTrabalho || (estado.config || []).find((c) => c.chave === 'trabalho' && !c.excluido_em)?.valor || {};
export const naoMeus = (estado) => new Set(configTrabalho(estado).naoMeus || []);
export const ehMeuCliente = (estado, chave) => !naoMeus(estado).has(chave);
export const todasAsPecas = (estado, hoje) => vivos(estado.conteudos).filter((p) => vigente(p, hoje));
// O que conta como trabalho dela (Hoje, avisos, Comece por aqui): só os clientes dela.
export const pecasAtivas = (estado, hoje) => todasAsPecas(estado, hoje).filter((p) => ehMeuCliente(estado, p.cliente));
export const clientesAtivos = (estado) => vivos(estado.clientesTrabalho).filter((c) => !/\bteste\b/.test(normalizar(c.nome)));
export const clientePelaChave = (estado, chave) => clientesAtivos(estado).find((c) => c.chave === chave) || null;

// ---------------------------------------------------------------------------
// O caminho da arte (Aprovar)
// ---------------------------------------------------------------------------
// No quadro da designer: em produção → em aprovação (vem para você) → você manda ao cliente → ele
// aprova (agendar) ou pede ajuste (volta para a designer). No Notion, a mesma coisa pelo status.

export const ETAPAS = [
  { id: 'design', nome: 'Com o design', ajuda: 'Confluir: prazo do design, 5 dias' },
  { id: 'voce', nome: 'Com você', ajuda: 'planejamento, copy e arte pronta para mandar' },
  { id: 'cliente', nome: 'Com o cliente', ajuda: 'esperando a resposta' },
  { id: 'agendar', nome: 'Agendar', ajuda: 'aprovada: falta pôr no quadro do cliente' },
  { id: 'equipe', nome: 'Com a equipe', ajuda: 'Essence: design, aprovação e agendamento. Só acompanhar' },
];

// Essence: o que é da Carol é o planejamento e a copy (pelo status) e o que está atribuído a ela no
// Notion. O resto (design, aprovação interna, envio e agendamento) é da gestora ou da sócia.
const STATUS_DA_CAROL = new Set(['copy em desenvolvimento', 'legenda pendente', 'copy pendente', 'roteiro', 'roteiro pendente', 'pauta', 'planejamento', 'a fazer', 'demandas', 'ajuste', 'ajuste de copy', 'nao iniciada', 'nao iniciado']);
export const atribuidaACarol = (p) => (p.dados?.responsaveis || []).some((n) => /\bcarol/.test(normalizar(n)));
export const ehDaCarol = (p) => STATUS_DA_CAROL.has(normalizar(p.status)) || atribuidaACarol(p);
export const DIAS_LIMITE_DESIGN = 5;

// Em que etapa está a peça (ou null, se não está no caminho da aprovação agora).
export function etapaDaPeca(p) {
  const fluxo = p.dados?.fluxo || {};
  const s = normalizar(p.status);
  // Confluir, quadro de produção (designer ou vídeos): o caminho da arte.
  if (p.dados?.producao) {
    const l = p.dados.producao;
    if (s === normalizar(l.aprovacao)) return fluxo.enviadoEm ? 'cliente' : 'voce';
    if (s === normalizar(l.aprovado)) return fluxo.agendadoEm ? null : 'agendar';
    return 'design';
  }
  // Confluir, quadro do cliente: é o calendário de postagem. Só "Posts para aprovação" espera o cliente.
  if (p.origem === 'trello') return s === 'posts para aprovacao' ? 'cliente' : null;
  // Essence (Notion): o que é seu fica com você; o resto, com a equipe (só acompanhar).
  const g = grupoDoStatus(p.status);
  if (g === 'postado' || s === 'agendado') return null;
  if (ehDaCarol(p)) return 'voce';
  return g === 'sem' && !p.status ? null : 'equipe';
}

export function quadroDeAprovar(pecas) {
  const colunas = Object.fromEntries(ETAPAS.map((e) => [e.id, []]));
  const noQuadroDoCliente = pecas.filter((p) => p.origem === 'trello' && !p.dados?.producao);
  for (const p of pecas) {
    if (grupoDoStatus(p.status) === 'postado') continue;
    const etapa = etapaDaPeca(p);
    // Aprovada que já foi para o quadro do cliente: está agendada, sai sozinha.
    if (etapa === 'agendar' && noQuadroDoCliente.some((c) => c.cliente === p.cliente && parecidos(c.titulo, p.titulo))) continue;
    if (etapa) colunas[etapa].push(p);
  }
  for (const lista of Object.values(colunas)) lista.sort((a, b) => String(a.data || a.entrega || '9999').localeCompare(String(b.data || b.entrega || '9999')));
  return colunas;
}

export const diasDesde = (em, agora = Date.now()) => (em ? Math.max(0, Math.floor((agora - Date.parse(em)) / 864e5)) : 0);

// Arte parada com a designer: passou do prazo ou está há dias sem movimento.
export function atrasoNoDesign(p, hoje, agora = Date.now()) {
  const parada = diasDesde(p.editado_em, agora);
  if (p.entrega && p.entrega < hoje) return { tipo: 'prazo', dias: parada };
  if (parada >= DIAS_LIMITE_DESIGN) return { tipo: 'parada', dias: parada };
  return null;
}

export const mensagemParaCliente = (p) => `Oi! Segue "${p.titulo}" para sua aprovação${p.data ? ` (publica ${diaMes(p.data)})` : ''}. Posso seguir assim ou quer ajustar algo?`;
export const lembreteParaCliente = (p) => `Oi! Conseguiu ver "${p.titulo}"? Com o seu ok eu já deixo agendado.`;
export const cobrancaParaDesigner = (p) => `Oi! Como está "${p.titulo}", de ${p.cliente_nome || 'cliente'}? Me diz se precisa de algo para fechar.`;
export const linkWhatsApp = (mensagem) => `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

// ---------------------------------------------------------------------------
// Radar: cliente sem peça pela frente e tema repetido
// ---------------------------------------------------------------------------

const JANELA = 14;
const VAZIAS = new Set(['para', 'como', 'com', 'que', 'uma', 'das', 'dos', 'nas', 'nos', 'por', 'sobre', 'mais', 'voce', 'sua', 'seu', 'nao', 'reels', 'carrossel', 'stories']);
function palavrasDoTitulo(t) {
  const sem = String(t || '').replace(/^[A-Za-z]{0,3}\d*\s*·\s*/, '');
  return new Set(normalizar(sem).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((p) => p.length > 2 && !VAZIAS.has(p)));
}
export function parecidos(a, b) {
  const x = palavrasDoTitulo(a);
  const y = palavrasDoTitulo(b);
  if (x.size < 2 || y.size < 2) return false;
  const comuns = [...x].filter((p) => y.has(p)).length;
  return comuns / (x.size + y.size - comuns) >= 0.6;
}

export function radar(pecas, hoje) {
  const alertas = [];
  const porCliente = new Map();
  for (const p of pecas) porCliente.set(p.cliente, [...(porCliente.get(p.cliente) || []), p]);
  for (const [cliente, itens] of porCliente) {
    const nome = itens[0].cliente_nome || cliente;
    const datas = itens.map((p) => p.data).filter(Boolean).sort();
    if (!datas.some((d) => d >= somarDias(hoje, -45))) continue; // conta parada, não buraco
    const proximos = datas.filter((d) => d >= hoje && d <= somarDias(hoje, JANELA));
    const semData = itens.some((p) => !p.data && !p.dados?.producao && grupoDoStatus(p.status) !== 'postado');
    if (!semData) {
      if (!proximos.length) alertas.push({ cliente, nome, tipo: 'buraco', titulo: `${nome} sem nada nos próximos ${JANELA} dias`, texto: 'Radar de buracos' });
      else {
        const seq = [hoje, ...proximos, somarDias(hoje, JANELA)];
        for (let i = 1; i < seq.length; i += 1) {
          const dias = diasEntre(seq[i - 1], seq[i]);
          if (dias >= 7) {
            alertas.push({ cliente, nome, tipo: 'buraco', titulo: `${nome} sem nada depois do dia ${Number(seq[i - 1].slice(8, 10))}`, texto: `Radar de buracos · ${dias} dias sem peça marcada` });
            break;
          }
        }
      }
    }
    const recentes = itens.filter((p) => p.data && p.data >= somarDias(hoje, -30));
    const vistos = new Set();
    for (let i = 0; i < recentes.length; i += 1) {
      for (let j = i + 1; j < recentes.length; j += 1) {
        const [a, b] = [recentes[i], recentes[j]];
        if (a.titulo === b.titulo && (a.formato !== b.formato || a.fonte !== b.fonte)) continue;
        if (/^stories\b/i.test(a.titulo) && /^stories\b/i.test(b.titulo)) continue;
        if (!parecidos(a.titulo, b.titulo) || vistos.has(a.titulo)) continue;
        vistos.add(a.titulo);
        const [x, y] = [a, b].sort((m, n) => String(m.data).localeCompare(String(n.data)));
        alertas.push({ cliente, nome, tipo: 'repetido', titulo: `Tema parecido em ${nome}`, texto: `"${x.titulo}" e "${y.titulo}", com ${Math.abs(diasEntre(x.data, y.data))} dias de distância`, ids: [x.id, y.id] });
      }
    }
  }
  return alertas;
}

// Peça que publica até amanhã (ou atrasou até 3 dias) e ainda não está pronta.
export function riscos(pecas, hoje) {
  const ate = somarDias(hoje, 1);
  const desde = somarDias(hoje, -3);
  const frase = { voce: 'ainda está com você', cliente: 'ainda está com o cliente', design: 'ainda está com o design', equipe: 'ainda está com a equipe' };
  return pecas.flatMap((p) => {
    const dono = p.origem === 'notion' ? ({ voce: 'voce', equipe: 'equipe' }[etapaDaPeca(p)] || comQuem(p.status)) : comQuem(p.status);
    if (!p.data || p.data < desde || p.data > ate || dono === 'pronto' || dono === 'feito' || p.dados?.producao) return [];
    // Quadro do cliente (Confluir): aprovado ou agendado já está pronto, não é risco.
    if (p.origem === 'trello' && ['pronto', 'postado'].includes(grupoDoStatus(p.status))) return [];
    return [{ peca: p, dono, texto: p.data < hoje ? `Era para ${quando(p.data, hoje)} e ${frase[dono]}` : `Publica ${quando(p.data, hoje)} e ${frase[dono]}` }];
  }).sort((a, b) => a.peca.data.localeCompare(b.peca.data));
}

// ---------------------------------------------------------------------------
// Visão de cada cliente (saúde)
// ---------------------------------------------------------------------------

export const SAUDES = { urgente: 'urgente', atencao: 'atenção', ok: 'ok', parado: 'parado' };
const ORDEM_SAUDE = { urgente: 0, atencao: 1, ok: 2, parado: 3 };

export function visaoDosClientes(clientes, pecas, hoje) {
  const porCliente = new Map();
  for (const p of pecas) porCliente.set(p.cliente, [...(porCliente.get(p.cliente) || []), p]);
  return clientes.map((cliente) => {
    const doCliente = porCliente.get(cliente.chave) || [];
    const conta = { voce: 0, cliente: 0, design: 0, pronto: 0 };
    for (const p of doCliente) {
      const etapa = etapaDaPeca(p);
      if (etapa === 'voce' || etapa === 'agendar') conta.voce += 1;
      else if (etapa === 'cliente') conta.cliente += 1;
      else if (etapa === 'design') conta.design += 1;
    }
    const futuras = doCliente.filter((p) => p.data && p.data >= hoje && grupoDoStatus(p.status) !== 'postado').sort((a, b) => a.data.localeCompare(b.data));
    const daSemana = doCliente.filter((p) => p.data && p.data >= segundaDe(hoje) && p.data <= somarDias(segundaDe(hoje), 6)).length;
    const r = riscos(doCliente, hoje);
    const perto = futuras.some((p) => p.data <= somarDias(hoje, JANELA));
    const ultima = doCliente.reduce((m, p) => (String(p.editado_em || '') > m ? String(p.editado_em) : m), '').slice(0, 10);
    const parado = !conta.voce && !conta.cliente && !conta.design && !perto && (!ultima || ultima < somarDias(hoje, -60));
    let saude = 'ok';
    let frase = 'tudo em dia';
    if (r.length) { saude = 'urgente'; frase = r.length === 1 ? r[0].texto.toLowerCase() : `${r.length} peças publicam até amanhã sem estar prontas`; }
    else if (parado) { saude = 'parado'; frase = 'sem movimento recente'; }
    else if (!perto) { saude = 'atencao'; frase = `nada nos próximos ${JANELA} dias`; }
    else if (conta.voce || conta.cliente) { saude = conta.voce ? 'atencao' : 'ok'; frase = [conta.voce && `${conta.voce} com você`, conta.cliente && `${conta.cliente} com o cliente`].filter(Boolean).join(' · '); }
    return { cliente, casa: casaDoCliente(cliente, doCliente), conta, proximas: futuras.slice(0, 5), daSemana, riscos: r, saude, frase };
  }).sort((a, b) => ORDEM_SAUDE[a.saude] - ORDEM_SAUDE[b.saude] || a.cliente.nome.localeCompare(b.cliente.nome, 'pt-BR'));
}

// Média de peças por semana nas últimas 4 semanas.
export function ritmo(pecas, hoje) {
  const desde = somarDias(hoje, -28);
  const n = pecas.filter((p) => p.data && p.data >= desde && p.data <= hoje).length;
  return Math.round((n / 4) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Comece por aqui (card do Hoje): no máximo 3 coisas do trabalho
// ---------------------------------------------------------------------------

export function comecePorAqui(estado, hoje, limite = 3) {
  const pecas = pecasAtivas(estado, hoje);
  const itens = [];
  for (const r of riscos(pecas, hoje).filter((x) => x.dono === 'voce')) {
    itens.push({ id: r.peca.id, titulo: r.peca.titulo, motivo: `${r.peca.cliente_nome || ''} · ${r.texto.toLowerCase()}`, rota: `#conteudo/${r.peca.id}` });
  }
  const q = quadroDeAprovar(pecas);
  for (const p of q.voce) {
    itens.push(p.origem === 'notion'
      ? { id: p.id, titulo: `Copy: ${p.titulo}`, motivo: `${p.cliente_nome || ''} · ${String(p.status || 'com você').toLowerCase()}`, rota: `#conteudo/${p.id}` }
      : { id: p.id, titulo: `Mandar para aprovar: ${p.titulo}`, motivo: `${p.cliente_nome || ''} · arte pronta`, rota: '#aprovar' });
  }
  for (const p of q.agendar) itens.push({ id: p.id, titulo: `Agendar: ${p.titulo}`, motivo: `${p.cliente_nome || ''} · aprovada`, rota: '#aprovar' });
  // Uma linha por peça (a primeira, que é a mais urgente).
  const vistos = new Set();
  return itens.filter((i) => (vistos.has(i.id) ? false : vistos.add(i.id))).slice(0, limite);
}

// Frases do que a Carol defende (da ficha dela): uma por dia, nos dias de trabalho.
export const TESES = [
  'Conteúdo que representa e converte, nessa ordem.',
  'Posicionamento é ponto de vista repetido com consistência.',
  'Crescimento orgânico vem de narrativa.',
  'Com processo e sistema, a gente trabalha menos no caos.',
  'Postar mais nunca foi a estratégia.',
];
export const teseDoDia = (hoje) => TESES[Math.abs(Math.floor(Date.parse(`${hoje}T12:00:00Z`) / 864e5)) % TESES.length];

// ---------------------------------------------------------------------------
// O que mudou (sem você): status ou data que mudou na origem nos últimos 3 dias
// ---------------------------------------------------------------------------

export function oQueMudou(pecas, agora = Date.now()) {
  return pecas.filter((p) => p.dados?.mudanca?.em && !p.dados.mudanca.visto && agora - Date.parse(p.dados.mudanca.em) < 3 * 864e5)
    .sort((a, b) => b.dados.mudanca.em.localeCompare(a.dados.mudanca.em));
}

export function textoDaMudanca(m) {
  const partes = [];
  if (m.statusPara) partes.push(m.statusDe ? `${m.statusDe} → ${m.statusPara}` : `entrou em ${m.statusPara}`);
  if (m.dataPara !== undefined && m.dataDe !== m.dataPara) partes.push(m.dataPara ? `data ${m.dataDe ? `${diaMes(m.dataDe)} → ` : ''}${diaMes(m.dataPara)}` : 'sem data');
  return partes.join(' · ') || 'mudou';
}

// ---------------------------------------------------------------------------
// Criar: formatos, objetivos, modelos e o revisor da Essence (sem IA, sem custo)
// ---------------------------------------------------------------------------

export const FORMATOS = ['Carrossel de conteúdo', 'Carrossel de conexão', 'Reels falado', 'Reels de texto na tela', 'Stories de venda', 'Legenda'];
export const OBJETIVOS = ['Conexão', 'Educação', 'Posicionamento', 'Venda'];

export const MODELOS = {
  'Carrossel de conteúdo': '## Capa\nGancho que gera curiosidade\n\n## Slides\nSlide 1:\nSlide 2:\nSlide 3:\n\n## Último slide\nCTA ligado ao objetivo\n\n## Legenda\nAprofunda, sem repetir os slides',
  'Carrossel de conexão': '## Capa\nFala do dia a dia do público\n\n## Desenvolvimento\nHistória ou opinião sobre o mercado\n\n## Fechamento\nPergunta ou identificação\n\n## Legenda',
  'Reels falado': '## Gancho na tela\nPrimeiros 2 segundos\n\n## Fala\nPensamento em voz alta, de 40 a 70 segundos\n\n## Virada\n\n## CTA falado\n\n## Produção\nEnquadramento:\nCapa:\nÁudio:\nEdição:\n\n## Legenda',
  'Reels de texto na tela': '## Texto na tela\nFrase de gancho e indicação para ler a legenda\n\n## Cena\nSelfie ou cena do dia a dia, de 8 a 10 segundos\n\n## Legenda\nConteúdo completo, em lista',
  'Stories de venda': '## Dor\nNa versão que o cliente final pensa\n\n## Solução\n\n## O que a pessoa recebe\n- item\n\n## Oferta\nPreço, condição ou cupom',
  Legenda: '## Legenda\n\n## Crédito\nAutor original, se o conteúdo não for do cliente',
};
const STATUS_INICIAL = { 'Reels falado': 'Vídeo pendente', 'Reels de texto na tela': 'Vídeo pendente', Legenda: 'Legenda pendente' };
export const statusInicial = (formato) => STATUS_INICIAL[formato] || 'Copy em desenvolvimento';

const REGRAS = [
  [/—/g, 'Travessão: use vírgula, ponto ou dois-pontos.'],
  [/\bn[ãa]o [ée] que\b[^.!?\n]*/gi, 'Negação + revelação ("não é que..."). Diga direto o que é.'],
  [/\bn[ãa]o [ée] sobre\b[^.!?\n]*/gi, 'Negação + revelação ("não é sobre...").'],
  [/\bn[ãa]o por\b[^.!?\n]*[.!?]\s*por\b[^.!?\n]*/gi, 'Negação + revelação ("não por... por...").'],
  [/\b(isso |e isso )?muda tudo\b/gi, 'Diga o que muda, com contexto.'],
  [/\bisso muda\b/gi, 'Diga o que muda, com contexto.'],
  [/\bmuda[^.!?\n]{0,40},\s*muda\b/gi, 'Repetição climática ("muda..., muda...").'],
  [/\btem (gente|criador|criadora)s?\b/gi, 'Sujeito vago: prefira "muitos criadores" ou "criadores que...".'],
  [/\bningu[ée]m percebe\b/gi, 'Juízo sobre o que as pessoas percebem.'],
  [/\bpouca gente sabe\b/gi, 'Juízo sobre o que as pessoas sabem.'],
  [/\bquase ningu[ée]m\b/gi, 'Juízo sobre o que as pessoas fazem.'],
  [/\bsem perceber\b/gi, 'Revelação por engano ("sem perceber").'],
  [/\bengole\b/gi, 'Revelação por engano ("engole").'],
  [/\bporque (o|a)\b[^.!?\n]*[.!?]\s*porque\b/gi, 'Causa encadeada artificial ("porque... porque...").'],
  [/\bquem (entender|aprender)\b[^.!?\n]*\b(antes|primeiro)\b[^.!?\n]*/gi, 'Promessa de vantagem por entender antes.'],
  [/\bpor tr[áa]s de cada\b/gi, 'Metáfora de descoberta ("por trás de cada...").'],
  [/(?<!\p{L})[àa]s vezes(?!\p{L})/giu, '"Às vezes": especifique ou tire.'],
  [/\bna pr[áa]tica\b/gi, '"Na prática": vá direto ao exemplo.'],
  [/\bcaminhada\b/gi, '"Caminhada" no sentido de processo.'],
  [/\baprofundamento\b/gi, 'Palavra vazia: "aprofundamento".'],
  [/\b(trazer|buscar|ter|falta de|com) clareza\b/gi, '"Clareza" como substantivo vago.'],
  [/\bcom inten[çc][ãa]o\b/gi, '"Intenção" como palavra de efeito.'],
  [/(?<!\p{L})cê(?=\s+\p{L})/giu, 'Prefira "você" a "cê".'],
  [/\b\d+([.,]\d+)?\s?(%|mil\b|milh)/gi, 'Número: confirme a fonte antes de aprovar.', 'confira'],
  [/\[esp[aç]o para preencher\]/gi, 'Falta preencher este espaço.', 'confira'],
];
const REGRAS_SAUDE = [
  [/\bantes e depois\b/gi, 'Saúde: antes e depois pode ser proibido pelo conselho.', 'confira'],
  [/\b(garant\w+|cura definitiva|sem riscos?|resultado (certo|garantido)|melhor (m[ée]dic|cl[ií]nic|dentist)\w*)\b/gi, 'Saúde: evite promessa de resultado ou superlativo.', 'confira'],
];
export const clienteDeSaude = (nome, nicho) => /^(dr|dra)\b\.?/i.test(nome || '') || /m[ée]dic|sa[úu]de|cl[íi]nic|odonto|psiqu|psicol|dermat|nutri|ginec|oftalmo/i.test(nicho || '');

// Cada alerta: { trecho, regra, tipo: 'proibido' | 'confira', inicio, fim } (posições no texto, para marcar).
export function revisar(texto, { saude = false } = {}) {
  const alertas = [];
  const vistos = new Set();
  for (const [padrao, regra, tipo = 'proibido'] of saude ? [...REGRAS, ...REGRAS_SAUDE] : REGRAS) {
    for (const m of String(texto || '').matchAll(padrao)) {
      const trecho = m[0].trim().slice(0, 90);
      const marca = `${regra}|${trecho.toLowerCase()}`;
      if (vistos.has(marca)) continue;
      vistos.add(marca);
      alertas.push({ trecho, regra, tipo, inicio: m.index, fim: m.index + m[0].length });
    }
  }
  return alertas.filter((a) => !alertas.some((b) => b !== a && b.tipo === a.tipo && b.trecho.length > a.trecho.length && b.trecho.toLowerCase().includes(a.trecho.toLowerCase())));
}
