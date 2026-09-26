// Сборка config.yaml для Mihomo (XKeen) из разобранных ссылок.
(function (root) {
  'use strict';

  const META = 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/';
  const REFILTER = 'https://github.com/legiz-ru/mihomo-rule-sets/raw/main/re-filter/';

  // Сервисы: какие наборы правил отправлять через прокси.
  const SERVICES = [
    { id: 'blocked', group: 'Заблокированное', label: 'Заблокированное в России', hint: 'список re:filter — основные заблокированные сайты', on: true,
      sets: [['refilter@domain', REFILTER + 'domain-rule.mrs', 'domain'], ['refilter@ipcidr', REFILTER + 'ip-rule.mrs', 'ipcidr']] },
    { id: 'youtube', label: 'YouTube', on: true, sets: [['youtube@domain', META + 'geosite/youtube.mrs', 'domain']] },
    { id: 'telegram', label: 'Telegram', on: true,
      sets: [['telegram@domain', META + 'geosite/telegram.mrs', 'domain'], ['telegram@ipcidr', META + 'geoip/telegram.mrs', 'ipcidr']] },
    { id: 'meta', group: 'Meta', label: 'Instagram, Facebook, WhatsApp', on: true,
      sets: [['meta@domain', META + 'geosite/meta.mrs', 'domain'], ['facebook@ipcidr', META + 'geoip/facebook.mrs', 'ipcidr']] },
    { id: 'twitter', group: 'X', label: 'X (Twitter)', on: true,
      sets: [['twitter@domain', META + 'geosite/twitter.mrs', 'domain'], ['twitter@ipcidr', META + 'geoip/twitter.mrs', 'ipcidr']] },
    { id: 'discord', label: 'Discord', on: true, sets: [['discord@domain', META + 'geosite/discord.mrs', 'domain']] },
    { id: 'ai', group: 'ИИ', label: 'ChatGPT, Claude и другие ИИ', on: true, sets: [['ai@domain', META + 'geosite/category-ai-!cn.mrs', 'domain']] },
    { id: 'tiktok', label: 'TikTok', on: false, sets: [['tiktok@domain', META + 'geosite/tiktok.mrs', 'domain']] },
    { id: 'spotify', label: 'Spotify', on: false, sets: [['spotify@domain', META + 'geosite/spotify.mrs', 'domain']] },
    { id: 'netflix', label: 'Netflix', on: false,
      sets: [['netflix@domain', META + 'geosite/netflix.mrs', 'domain'], ['netflix@ipcidr', META + 'geoip/netflix.mrs', 'ipcidr']] },
    { id: 'github', label: 'GitHub', on: false, sets: [['github@domain', META + 'geosite/github.mrs', 'domain']] },
    { id: 'twitch', label: 'Twitch', on: false, sets: [['twitch@domain', META + 'geosite/twitch.mrs', 'domain']] },
  ];

  // ---------- YAML ----------

  const PLAIN = /^[A-Za-z0-9_][A-Za-z0-9_.\/@:+-]*$/;
  const RESERVED = /^(true|false|yes|no|on|off|null|~|y|n|[-+]?[0-9][0-9_.eE+-]*|0x[0-9a-f]+)$/i;

  function scalar(v) {
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    const s = String(v);
    return PLAIN.test(s) && !RESERVED.test(s) && !s.includes(': ') ? s : JSON.stringify(s);
  }

  function flow(v) {
    if (Array.isArray(v)) return '[' + v.map(flow).join(', ') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).map((k) => scalar(k) + ': ' + flow(v[k])).join(', ') + '}';
    return scalar(v);
  }

  function yaml(v, ind) {
    ind = ind || '';
    if (Array.isArray(v)) {
      if (!v.length) return ' []\n';
      return '\n' + v.map((x) => {
        if (x && typeof x === 'object' && !Array.isArray(x)) {
          const body = yaml(x, ind + '  ').replace(/^\n/, '');
          return ind + '- ' + body.slice(ind.length + 2);
        }
        return ind + '- ' + scalar(x) + '\n';
      }).join('');
    }
    if (v && typeof v === 'object') {
      return '\n' + Object.keys(v).map((k) => {
        const x = v[k];
        if (x && typeof x === 'object') {
          if (x.__flow) { const c = Object.assign({}, x); delete c.__flow; return ind + scalar(k) + ': ' + flow(c) + '\n'; }
          return ind + scalar(k) + ':' + yaml(x, ind + '  ');
        }
        return ind + scalar(k) + ': ' + scalar(x) + '\n';
      }).join('');
    }
    return ' ' + scalar(v) + '\n';
  }

  function clean(o) {
    Object.keys(o).forEach((k) => {
      const v = o[k];
      if (v === undefined || v === '' || v === false && k !== 'tls' && k !== 'udp' || (Array.isArray(v) && !v.length)) delete o[k];
    });
    return o;
  }

  // ---------- прокси ----------

  function transportOpts(p, o) {
    const t = p.transport;
    if (t.network === 'tcp') {
      if (t.headerType === 'http') {
        o.network = 'http';
        o['http-opts'] = clean({ path: [t.path], headers: t.host ? { Host: [t.host] } : undefined });
      } else o.network = 'tcp';
    } else if (t.network === 'ws' || t.network === 'httpupgrade') {
      o.network = 'ws';
      o['ws-opts'] = clean({ path: t.path, headers: t.host ? { Host: t.host } : undefined, 'v2ray-http-upgrade': t.network === 'httpupgrade' || undefined });
    } else if (t.network === 'grpc') {
      o.network = 'grpc';
      o['grpc-opts'] = { 'grpc-service-name': t.serviceName };
    } else if (t.network === 'xhttp') {
      o.network = 'xhttp';
      o['xhttp-opts'] = clean({ path: t.path, host: t.host, mode: t.mode });
    }
  }

  function tlsOpts(p, o, sniKey) {
    const s = p.tls;
    if (s.security === 'none') { o.tls = false; return; }
    o.tls = true;
    o[sniKey] = s.sni;
    o['client-fingerprint'] = s.fp || undefined;
    o.alpn = s.alpn;
    o['skip-cert-verify'] = s.insecure || undefined;
    if (s.security === 'reality') o['reality-opts'] = clean({ 'public-key': s.pbk, 'short-id': s.sid });
  }

  function proxy(p) {
    const o = { name: p.name, type: p.type, server: p.server, port: p.port, udp: true };
    switch (p.type) {
      case 'vless':
        o.uuid = p.uuid; o.flow = p.flow || undefined;
        transportOpts(p, o); tlsOpts(p, o, 'servername');
        break;
      case 'vmess':
        o.uuid = p.uuid; o.alterId = p.alterId; o.cipher = p.cipher;
        transportOpts(p, o); tlsOpts(p, o, 'servername');
        break;
      case 'trojan':
        o.password = p.password;
        transportOpts(p, o); tlsOpts(p, o, 'sni');
        if (o.network === 'tcp') delete o.network;
        delete o.tls;
        break;
      case 'ss':
        o.cipher = p.method; o.password = p.password;
        break;
      case 'hysteria2':
        o.password = p.password; o.sni = p.sni; o.alpn = p.alpn;
        o['skip-cert-verify'] = (p.insecure && !p.pinSHA256) || undefined;
        o.fingerprint = p.pinSHA256 || undefined;
        if (p.obfs) { o.obfs = p.obfs; o['obfs-password'] = p.obfsPassword; }
        break;
    }
    return clean(o);
  }

  function randomSecret() {
    const a = new Uint8Array(12);
    (root.crypto || require('crypto').webcrypto).getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function domains(text) {
    return (text || '').split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, ''))
      .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  }

  // opts: services[], subscription, perService, finalProxy, blockAds, blockQuic, proxyDomains, directDomains
  function build(proxies, opts) {
    opts = opts || {};
    const services = SERVICES.filter((s) => (opts.services || SERVICES.filter((x) => x.on).map((x) => x.id)).includes(s.id));
    if (!proxies.length && !opts.subscription) throw new Error('Добавьте хотя бы одну ссылку или подписку.');

    const cfg = {
      'log-level': 'warning',
      'allow-lan': true,
      'redir-port': 5000,
      'tproxy-port': 5001,
      'routing-mark': 255,
      'find-process-mode': 'off',
      'unified-delay': true,
      'external-controller': '0.0.0.0:9090',
      secret: opts.secret || randomSecret(),
      'external-ui': 'zashboard',
      'external-ui-url': 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
      sniffer: {
        enable: true,
        sniff: { HTTP: { __flow: 1, ports: [80, 8080] }, TLS: { __flow: 1, ports: [443, 8443] }, QUIC: { __flow: 1, ports: [443, 8443] } },
      },
    };
    if (services.some((s) => s.id === 'telegram')) cfg.sniffer['skip-dst-address'] = ['rule-set:telegram@ipcidr'];

    if (proxies.length) cfg.proxies = proxies.map(proxy);
    if (opts.subscription) {
      cfg['proxy-providers'] = {
        subscription: {
          type: 'http', url: opts.subscription, interval: 3600, path: './providers/subscription.yaml',
          'health-check': { enable: true, url: 'https://www.gstatic.com/generate_204', interval: 300 },
        },
      };
    }

    const PROXY = 'Прокси';
    const groups = [
      { name: PROXY, type: 'select', proxies: ['Авто'], 'include-all': true },
      { name: 'Авто', type: 'url-test', url: 'https://www.gstatic.com/generate_204', interval: 300, tolerance: 50, 'include-all': true },
    ];
    const target = {};
    services.forEach((s) => {
      if (opts.perService) {
        // В правилах запятая — разделитель, поэтому имя группы без запятых.
        const g = (s.group || s.label).replace(/,/g, '');
        groups.push({ name: g, type: 'select', proxies: [PROXY, 'DIRECT'], 'include-all': true });
        target[s.id] = g;
      } else target[s.id] = PROXY;
    });
    cfg['proxy-groups'] = groups;

    const providers = {};
    const addSet = (name, url, behavior) => {
      providers[name] = { __flow: 1, type: 'http', format: 'mrs', behavior, url, path: './rules/' + name.replace('@', '-') + '.mrs', interval: 86400 };
    };
    services.forEach((s) => s.sets.forEach((x) => addSet(x[0], x[1], x[2])));
    if (opts.blockAds) addSet('ads@domain', META + 'geosite/category-ads-all.mrs', 'domain');
    const pd = domains(opts.proxyDomains), dd = domains(opts.directDomains);
    if (pd.length) providers['my-proxy@inline'] = { type: 'inline', behavior: 'domain', payload: pd.map((d) => '+.' + d) };
    if (dd.length) providers['my-direct@inline'] = { type: 'inline', behavior: 'domain', payload: dd.map((d) => '+.' + d) };
    if (Object.keys(providers).length) cfg['rule-providers'] = providers;

    const rules = [];
    if (dd.length) rules.push('RULE-SET,my-direct@inline,DIRECT');
    if (opts.blockAds) rules.push('RULE-SET,ads@domain,REJECT');
    if (opts.blockQuic) rules.push('AND,((NETWORK,UDP),(DST-PORT,443)),REJECT');
    if (pd.length) rules.push('RULE-SET,my-proxy@inline,' + PROXY);
    services.forEach((s) => s.sets.forEach((x) => {
      rules.push('RULE-SET,' + x[0] + ',' + target[s.id] + (x[2] === 'ipcidr' ? ',no-resolve' : ''));
    }));
    rules.push('MATCH,' + (opts.finalProxy ? PROXY : 'DIRECT'));
    cfg.rules = rules;

    const head = '# Сгенерировано: https://itsnotkubrick.github.io/Reality_Hysteria2/tools/mihomo/\n' +
      '# Файл для XKeen: /opt/etc/mihomo/config.yaml, затем xkeen -restart\n' +
      '# Панель управления: http://IP-роутера:9090/ui (секрет — поле secret ниже)\n';
    return { yaml: head + yaml(cfg).replace(/^\n/, ''), config: cfg, count: proxies.length };
  }

  const api = { buildMihomo: build, MIHOMO_SERVICES: SERVICES, toYaml: (v) => yaml(v).replace(/^\n/, '') };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PM = Object.assign(root.PM || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
