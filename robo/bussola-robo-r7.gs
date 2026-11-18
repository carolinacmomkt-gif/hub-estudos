/**
 * Robô da R7 para a Bússola (Google Apps Script, roda de graça na conta Google da Carol).
 *
 * O que faz, sem gastar nada da Netlify:
 *  - toda segunda às 6h: lê os briefings de vídeo (pasta de briefings → ano → mês) e as pastas
 *    "VIDEOS <MÊS>" (com a subpasta USADO) de cada cliente, e manda o resumo para a Bússola;
 *  - de 2 em 2 horas, nos dias úteis: lê os quadros dos designers no Trello da R7 e manda o resumo, com a
 *    descrição dos cards e as artes anexadas (guardadas uma vez no Storage da Bússola, numa pasta só do robô).
 *
 * Só leitura: nunca cria, move, renomeia ou apaga nada no Drive nem no Trello (só GET).
 * Nada secreto fica neste arquivo: o código do robô, o Trello e a pasta ficam nas Propriedades do script
 * (Configurações do projeto → Propriedades do script), na conta dela.
 *
 * Propriedades do script:
 *   BUSSOLA_SUPABASE_URL   endereço do Supabase (o mesmo do app)
 *   BUSSOLA_CHAVE_PUBLICA  a chave pública (anon) do Supabase
 *   BUSSOLA_CODIGO         o código do robô gerado na Bússola (R7 → Ajustes da R7 → Robô do Google)
 *   PASTA_BRIEFINGS        o id da pasta dos briefings (o que vem depois de /folders/ no endereço)
 *   TRELLO_CHAVE           a chave do app do Trello (a mesma pública da Bússola)
 *   TRELLO_TOKEN           o token da conta da R7, só leitura
 *   QUADROS                (opcional) nomes dos quadros dos designers, separados por vírgula
 *
 * Primeira vez: rode "instalar" uma vez (ele cria os horários) e "testar" para mandar a primeira leitura.
 */

var MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

function prop(nome) {
  return PropertiesService.getScriptProperties().getProperty(nome) || '';
}

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (g) { ScriptApp.deleteTrigger(g); });
  ScriptApp.newTrigger('rodarVideos').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
  ScriptApp.newTrigger('rodarTrello').timeBased().everyHours(2).create();
  Logger.log('Horários instalados: vídeos na segunda às 6h e Trello de 2 em 2 horas (só dia útil).');
}

function testar() {
  rodarVideos();
  rodarTrello(true);
}

function enviar(tipo, dados) {
  var url = prop('BUSSOLA_SUPABASE_URL').replace(/\/+$/, '') + '/rest/v1/rpc/receber_do_robo';
  var r = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: prop('BUSSOLA_CHAVE_PUBLICA'), Authorization: 'Bearer ' + prop('BUSSOLA_CHAVE_PUBLICA') },
    payload: JSON.stringify({ codigo: prop('BUSSOLA_CODIGO'), tipo: tipo, dados: dados }),
    muteHttpExceptions: true,
  });
  Logger.log(tipo + ': ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  if (r.getResponseCode() >= 300) throw new Error('A Bússola recusou (' + r.getResponseCode() + '). Confira o código do robô.');
}

// ---------------------------------------------------------------------------
// Vídeos: briefings e editados
// ---------------------------------------------------------------------------

function textoDoArquivo(arquivo) {
  var tipo = arquivo.getMimeType();
  if (tipo === MimeType.GOOGLE_DOCS) return DocumentApp.openById(arquivo.getId()).getBody().getText();
  if (/wordprocessingml/.test(tipo) || /\.docx$/i.test(arquivo.getName())) {
    var partes = Utilities.unzip(arquivo.getBlob().setContentType('application/zip'));
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].getName() === 'word/document.xml') {
        var xml = partes[i].getDataAsString('UTF-8');
        return xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      }
    }
  }
  return '';
}

function rodarVideos() {
  var pasta = DriveApp.getFolderById(prop('PASTA_BRIEFINGS'));
  var briefings = [];
  var anos = pasta.getFolders();
  var agora = new Date();
  while (anos.hasNext()) {
    var ano = anos.next();
    if (!/^\d{4}$/.test(ano.getName().trim()) || Number(ano.getName()) < agora.getFullYear() - 1) continue;
    var meses = ano.getFolders();
    while (meses.hasNext()) {
      var mes = meses.next();
      // só os últimos 4 meses (os briefings antigos que ainda têm vídeo continuam no banco da Bússola)
      if (agora - mes.getLastUpdated() > 130 * 864e5 && agora - mes.getDateCreated() > 130 * 864e5) continue;
      var arquivos = mes.getFiles();
      while (arquivos.hasNext()) {
        var a = arquivos.next();
        var texto = '';
        try { texto = textoDoArquivo(a); } catch (e) { texto = ''; }
        if (!texto) continue;
        briefings.push({ id: a.getId(), arquivo: a.getName(), ano: ano.getName().trim(), pasta: mes.getName().trim(), modificado: a.getLastUpdated().toISOString(), texto: texto.slice(0, 30000) });
      }
    }
  }
  var producao = [];
  var desde = new Date(agora - 200 * 864e5).toISOString().slice(0, 10);
  var pastas = DriveApp.searchFolders('title contains "VIDEOS" and modifiedDate > "' + desde + '"');
  while (pastas.hasNext()) {
    var p = pastas.next();
    if (!/^\s*V[IÍ]DEOS\s+\S+/i.test(p.getName())) continue; // "VIDEOS SETEMBRO" (produção); a captação vem com o nome na frente
    var ano2 = p.getParents().hasNext() ? p.getParents().next() : null;
    var cliente = ano2 && ano2.getParents().hasNext() ? ano2.getParents().next().getName() : '';
    var editados = [];
    var fs = p.getFiles();
    while (fs.hasNext()) { var f = fs.next(); if (/^video\//.test(f.getMimeType()) || /\.(mp4|mov|m4v)/i.test(f.getName())) editados.push(f.getName()); }
    var usados = [];
    var subs = p.getFoldersByName('USADO');
    while (subs.hasNext()) { var u = subs.next().getFiles(); while (u.hasNext()) usados.push(u.next().getName()); }
    producao.push({ cliente: cliente, pasta: p.getName().trim(), editados: editados.slice(0, 200), usados: usados.slice(0, 200) });
  }
  enviar('videos', { briefings: briefings.slice(0, 80), producao: producao.slice(0, 120), lido_em: agora.toISOString() });
}

// ---------------------------------------------------------------------------
// Trello da R7 (só GET)
// ---------------------------------------------------------------------------

function trello(caminho) {
  var url = 'https://api.trello.com/1' + caminho + (caminho.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(prop('TRELLO_CHAVE')) + '&token=' + encodeURIComponent(prop('TRELLO_TOKEN'));
  var r = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Trello ' + r.getResponseCode() + ' em ' + caminho.split('?')[0]);
  return JSON.parse(r.getContentText());
}

// Artes dos cards (Carol, 17/11/2026): as imagens anexadas pelos designers vão para o Storage da Bússola
// (pasta com o SHA-256 do código do robô, que só ele e a dona enxergam), uma vez cada. A Bússola põe cada
// arte na peça certa do cronograma pela copy da descrição do card.
var MAX_ARTES_POR_RODADA = 40;
var MAX_BYTES = 8 * 1024 * 1024;

function pastaDoRobo() {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, prop('BUSSOLA_CODIGO'), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

// Os ids dos anexos já guardados, em pedaços (cada propriedade aceita até 9 KB).
function enviados() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var lista = [];
  Object.keys(props).filter(function (k) { return /^ENVIADOS_\d+$/.test(k); }).sort().forEach(function (k) { lista = lista.concat(props[k].split(',').filter(String)); });
  return lista;
}
function guardarEnviados(lista) {
  var props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter(function (k) { return /^ENVIADOS_\d+$/.test(k); }).forEach(function (k) { props.deleteProperty(k); });
  var ultimos = lista.slice(-3000);
  for (var i = 0; i * 300 < ultimos.length; i++) props.setProperty('ENVIADOS_' + i, ultimos.slice(i * 300, (i + 1) * 300).join(','));
}

function extensao(nome, tipo) {
  var m = /\.(png|jpe?g|webp|gif)$/i.exec(nome || '');
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : (/png/.test(tipo || '') ? 'png' : 'jpg');
}

function guardarArte(cartao, anexo, pasta) {
  var caminho = pasta + '/' + anexo.id + '.' + extensao(anexo.name, anexo.mimeType);
  var auth = 'OAuth oauth_consumer_key="' + prop('TRELLO_CHAVE') + '", oauth_token="' + prop('TRELLO_TOKEN') + '"';
  var r = UrlFetchApp.fetch('https://api.trello.com/1/cards/' + cartao + '/attachments/' + anexo.id + '/download/' + encodeURIComponent(anexo.name || 'arte'), { method: 'get', headers: { Authorization: auth }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var blob = r.getBlob();
  if (blob.getBytes().length > MAX_BYTES) return null;
  var url = prop('BUSSOLA_SUPABASE_URL').replace(/\/+$/, '') + '/storage/v1/object/robo-r7/' + caminho;
  var s = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: blob.getContentType() || 'image/jpeg',
    headers: { apikey: prop('BUSSOLA_CHAVE_PUBLICA'), Authorization: 'Bearer ' + prop('BUSSOLA_CHAVE_PUBLICA') },
    payload: blob.getBytes(),
    muteHttpExceptions: true,
  });
  var codigo = s.getResponseCode();
  if (codigo >= 300 && !/Duplicate|already exists/i.test(s.getContentText())) { Logger.log('Arte não guardada (' + codigo + '): ' + s.getContentText().slice(0, 160)); return null; }
  return caminho;
}

function rodarTrello(forcar) {
  var agora = new Date();
  var dia = agora.getDay();
  if (!forcar && (dia === 0 || dia === 6 || agora.getHours() < 7 || agora.getHours() > 20)) return; // só dia útil, 7h–20h
  var nomes = prop('QUADROS').split(',').map(function (n) { return n.trim().toLowerCase(); }).filter(String);
  var quadros = trello('/members/me/boards?filter=open&fields=name').filter(function (q) {
    var n = q.name.toLowerCase();
    return nomes.length ? nomes.indexOf(n) >= 0 : /desing|design/.test(n) && !/portf|trafeg|tráfeg/.test(n);
  });
  var limite = agora - 45 * 864e5;
  var pasta = pastaDoRobo();
  var ja = enviados();
  var jaSet = {};
  ja.forEach(function (id) { jaSet[id] = true; });
  var guardadas = 0;
  var saida = [];
  var ehIdentidade = function (c) { return /\b(idv|infos?|identidade)\b/i.test(c.name); };
  quadros.forEach(function (q) {
    var listas = {};
    trello('/boards/' + q.id + '/lists?filter=open&fields=name').forEach(function (l) { listas[l.id] = l.name; });
    var cartoes = trello('/boards/' + q.id + '/cards?filter=open&fields=name,desc,idList,due,dueComplete,dateLastActivity,labels,shortUrl&members=true&member_fields=fullName&attachments=true&attachment_fields=id,name,mimeType,pos,isUpload,bytes');
    saida.push({
      quadro: q.name,
      cartoes: cartoes.filter(function (c) { return listas[c.idList] && (ehIdentidade(c) || Date.parse(c.dateLastActivity) > limite || (c.due && Date.parse(c.due) > limite)); })
        .slice(0, 400).map(function (c) {
          var imagens = (c.attachments || []).filter(function (a) { return a.isUpload && /^image\//.test(a.mimeType || '') && (!a.bytes || a.bytes <= MAX_BYTES); });
          var anexos = [];
          imagens.forEach(function (a) {
            var caminho = pasta + '/' + a.id + '.' + extensao(a.name, a.mimeType);
            if (!jaSet[a.id] && guardadas < MAX_ARTES_POR_RODADA && !ehIdentidade(c)) {
              if (guardarArte(c.id, a, pasta)) { jaSet[a.id] = true; ja.push(a.id); guardadas++; }
            }
            if (jaSet[a.id]) anexos.push({ id: a.id, nome: String(a.name || '').slice(0, 120), pos: a.pos || 0, caminho: caminho });
          });
          return { lista: listas[c.idList], nome: String(c.name).slice(0, 160), vence: c.due || null, feito: Boolean(c.dueComplete),
            etiquetas: (c.labels || []).map(function (e) { return e.name; }).filter(String), membros: (c.members || []).map(function (m) { return m.fullName; }),
            ativo: c.dateLastActivity, url: c.shortUrl,
            desc: (imagens.length || ehIdentidade(c)) ? String(c.desc || '').slice(0, 3000) : '',
            anexos: anexos };
        }),
    });
  });
  guardarEnviados(ja);
  // Portfolio dos Clientes (informações de cada cliente: registro, @, cores, fontes). Cards e linhas com
  // senha, login ou acesso ficam de fora: acesso nunca sai do Trello.
  var segredo = /senha|password|login|acesso|token|e-?mail\s*:/i;
  var portfolio = [];
  trello('/members/me/boards?filter=open&fields=name').filter(function (q) { return /portf/i.test(q.name); }).forEach(function (q) {
    var listasP = {};
    trello('/boards/' + q.id + '/lists?filter=open&fields=name').forEach(function (l) { listasP[l.id] = l.name; });
    trello('/boards/' + q.id + '/cards?filter=open&fields=name,desc,idList,labels').slice(0, 400).forEach(function (c) {
      if (!listasP[c.idList] || segredo.test(c.name)) return;
      portfolio.push({ quadro: q.name, lista: listasP[c.idList], nome: String(c.name).slice(0, 160),
        desc: String(c.desc || '').split('\n').filter(function (l) { return !segredo.test(l); }).join('\n').slice(0, 2000),
        etiquetas: (c.labels || []).map(function (e) { return e.name; }).filter(String) });
    });
  });
  if (guardadas) Logger.log(guardadas + ' artes novas guardadas na Bússola.');
  enviar('trello', { quadros: saida, portfolio: portfolio, lido_em: agora.toISOString() });
}
