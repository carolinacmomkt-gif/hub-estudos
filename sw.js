// Service worker: guarda os arquivos do app para abrir rápido e funcionar sem internet.
// Ao mudar qualquer arquivo da lista, aumente a VERSAO para o app oferecer a atualização.

const VERSAO = 'hub-v22';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/temas.css',
  './css/base.css',
  './css/layout.css',
  './css/componentes.css',
  './css/editor.css',
  './css/calendario.css',
  './js/tema-inicial.js',
  './js/main.js',
  './js/tema.js',
  './js/estado.js',
  './js/rotas.js',
  './js/icones.js',
  './js/utilidades.js',
  './js/componentes.js',
  './js/dados-exemplo.js',
  './js/eventos.js',
  './js/nuvem.js',
  './js/persistencia.js',
  './js/funcoes.js',
  './js/preferencias.js',
  './js/views-login.js',
  './js/views-criar.js',
  './js/views-caneta.js',
  './js/views-faculdade.js',
  './js/dados-faculdade.js',
  './js/faculdade-sinc.js',
  './js/views-calendario.js',
  './js/dados-calendario.js',
  './js/eventos-calendario.js',
  './js/importar-calendario.js',
  './js/avisos.js',
  './js/views-avisos.js',
  './js/eventos-avisos.js',
  './js/plano-estudo.js',
  './js/views-plano.js',
  './js/inicio-layout.js',
  './js/views-inicio-proprios.js',
  './js/eventos-inicio.js',
  './js/views-cadernos.js',
  './js/editor-caderno.js',
  './js/eventos-cadernos.js',
  './js/formas.js',
  './js/folhas.js',
  './css/inicio.css',
  './js/editor-tinta.js',
  './js/vendor/perfect-freehand.js',
  './js/views-navegacao.js',
  './js/views-inicio.js',
  './js/views-areas.js',
  './js/views-configuracoes.js',
  './icones/icone.svg',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './icones/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'pular-espera') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);

  // Só arquivos do próprio app. Funções da Netlify e o Supabase nunca passam pelo cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/')) return;

  // Abrir o app: tenta a rede e, sem internet, usa a cópia guardada.
  if (request.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        const resposta = await fetch(request);
        const cache = await caches.open(VERSAO);
        cache.put('./index.html', resposta.clone());
        return resposta;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Demais arquivos: responde do cache na hora e atualiza em segundo plano.
  evento.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const guardado = await cache.match(request);
    const daRede = fetch(request)
      .then((resposta) => {
        if (resposta.ok) cache.put(request, resposta.clone());
        return resposta;
      })
      .catch(() => guardado);
    if (guardado) {
      evento.waitUntil(daRede);
      return guardado;
    }
    return daRede;
  })());
});

// Avisos de prazo (Web Push): chegam mesmo com o app fechado.
self.addEventListener('push', (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { texto: evento.data?.text() };
  }
  evento.waitUntil(self.registration.showNotification(aviso.titulo || 'Hub de Estudos', {
    body: aviso.texto || '',
    tag: aviso.tag,
    icon: './icones/icone-192.png',
    badge: './icones/icone-192.png',
    data: { url: aviso.url || './' },
  }));
});

// Tocar no aviso abre o app (ou traz para a frente a janela que já estava aberta).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || './', self.registration.scope).href;
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) {
      await aberta.focus();
      return aberta.navigate(destino).catch(() => aberta.postMessage({ tipo: 'abrir', url: destino }));
    }
    return self.clients.openWindow(destino);
  })());
});
