// Сборка конфигов Xray для XKeen: 04_outbounds.json и 05_routing.json.
(function (root) {
  'use strict';

  // ---------- outbounds ----------

  function clean(o) {
    Object.keys(o).forEach((k) => (o[k] === undefined || o[k] === '') && delete o[k]);
    return o;
  }

  function stream(p) {
    const t = p.transport, s = p.tls;
    const st = { network: t.network === 'tcp' ? 'raw' : t.network, security: s.security };
    if (t.network === 'ws') st.wsSettings = clean({ path: t.path, host: t.host });
    if (t.network === 'httpupgrade') st.httpupgradeSettings = clean({ path: t.path, host: t.host });
    if (t.network === 'grpc') st.grpcSettings = { serviceName: t.serviceName, multiMode: !!t.multiMode };
    if (t.network === 'xhttp') st.xhttpSettings = clean({ path: t.path, host: t.host, mode: t.mode });
    if (t.network === 'tcp' && t.headerType === 'http') {
      st.rawSettings = { header: { type: 'http', request: { path: [t.path], headers: t.host ? { Host: [t.host] } : {} } } };
    }
    if (s.security === 'tls') {
      st.tlsSettings = clean({ serverName: s.sni, fingerprint: s.fp, alpn: s.alpn.length ? s.alpn : undefined, allowInsecure: s.insecure || undefined });
    }
    if (s.security === 'reality') {
      st.realitySettings = clean({ serverName: s.sni, fingerprint: s.fp || 'chrome', publicKey: s.pbk, shortId: s.sid, spiderX: s.spx });
    }
    return st;
  }

  function outbound(p, tag) {
    switch (p.type) {
      case 'vless':
        return {
          tag, protocol: 'vless',
          settings: { vnext: [{ address: p.server, port: p.port, users: [clean({ id: p.uuid, encryption: 'none', flow: p.flow })] }] },
          streamSettings: stream(p),
        };
      case 'vmess':
        return {
          tag, protocol: 'vmess',
          settings: { vnext: [{ address: p.server, port: p.port, users: [{ id: p.uuid, alterId: p.alterId, security: p.cipher }] }] },
          streamSettings: stream(p),
        };
      case 'trojan':
        return {
          tag, protocol: 'trojan',
          settings: { servers: [{ address: p.server, port: p.port, password: p.password }] },
          streamSettings: stream(p),
        };
      case 'ss':
        return {
          tag, protocol: 'shadowsocks',
          settings: { servers: [{ address: p.server, port: p.port, method: p.method, password: p.password }] },
        };
      default:
        throw new Error(p.type === 'hysteria2'
          ? 'Hysteria2 в XKeen работает через ядро Mihomo — возьмите генератор Mihomo'
          : 'протокол ' + p.type + ' не поддерживается Xray');
    }
  }

  // ---------- routing ----------

  // Геобазы, которые ставит XKeen (имена файлов в /opt/etc/xray/dat).
  const BASES = {
    zkeen: { label: 'ZKeen', hint: 'ставится XKeen по умолчанию, рекомендуется', site: 'zkeen.dat', ip: 'zkeenip.dat' },
    v2fly: { label: 'V2Fly', hint: 'нужна для отдельных сервисов и блокировки рекламы', site: 'geosite_v2fly.dat', ip: 'geoip_v2fly.dat' },
    refilter: { label: 'Re:filter', hint: 'большой список заблокированного', site: 'geosite_refilter.dat', ip: 'geoip_refilter.dat' },
  };

  // Сервис → правила по базам. d: домены, i: IP. Берутся все доступные базы.
  const SERVICES = [
    { id: 'blocked', label: 'Заблокированное в России', on: true,
      zkeen: { d: ['domains', 'other', 'politic'] }, refilter: { d: ['refilter'], i: ['refilter'] } },
    { id: 'youtube', label: 'YouTube', on: true, zkeen: { d: ['youtube'], i: ['youtube'] }, v2fly: { d: ['youtube'] } },
    { id: 'telegram', label: 'Telegram', on: true, zkeen: { i: ['telegram'] }, v2fly: { d: ['telegram'] } },
    { id: 'meta', label: 'Instagram, Facebook, WhatsApp', on: true, zkeen: { i: ['meta'] }, v2fly: { d: ['meta'] } },
    { id: 'discord', label: 'Discord', on: true, zkeen: { i: ['discord'] }, v2fly: { d: ['discord'] } },
    { id: 'twitter', label: 'X (Twitter)', on: true, v2fly: { d: ['twitter'] } },
    { id: 'ai', label: 'ChatGPT, Claude и другие ИИ', on: true, v2fly: { d: ['category-ai-!cn'] } },
    { id: 'cdn', label: 'Зарубежные CDN и хостинги', hint: 'Cloudflare, Hetzner, DigitalOcean… — их часто замедляют', on: true,
      zkeen: { i: ['akamai', 'amazon', 'arelion', 'azure', 'bunnycdn', 'cdn77', 'cloudflare', 'cogent', 'colocrossing', 'contabo',
        'datacamp', 'digitalocean', 'fastly', 'frantech', 'gcore', 'hetzner', 'leaseweb', 'linode', 'liquidweb', 'mega', 'melbicom',
        'oracle', 'ovh', 'scaleway', 'vodafone', 'vultr'] } },
    { id: 'tiktok', label: 'TikTok', on: false, v2fly: { d: ['tiktok'] } },
    { id: 'spotify', label: 'Spotify', on: false, v2fly: { d: ['spotify'] } },
    { id: 'netflix', label: 'Netflix', on: false, v2fly: { d: ['netflix'] } },
    { id: 'github', label: 'GitHub', on: false, v2fly: { d: ['github'] } },
    { id: 'twitch', label: 'Twitch', on: false, v2fly: { d: ['twitch'] } },
  ];

  function available(service, bases) {
    return bases.some((b) => service[b]);
  }

  function domains(text) {
    return (text || '').split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, ''))
      .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  }

  function routing(opts, proxyTag) {
    const bases = opts.bases || ['zkeen'];
    const chosen = SERVICES.filter((s) => (opts.services || SERVICES.filter((x) => x.on).map((x) => x.id)).includes(s.id) && available(s, bases));
    const dom = [], ip = [];
    chosen.forEach((s) => bases.forEach((b) => {
      const r = s[b];
      if (!r) return;
      (r.d || []).forEach((c) => dom.push('ext:' + BASES[b].site + ':' + c));
      (r.i || []).forEach((c) => ip.push('ext:' + BASES[b].ip + ':' + c));
    }));
    const uniq = (a) => Array.from(new Set(a));

    // Политика xkeen_full: всё с этих входов — через прокси (как в стандартном конфиге XKeen).
    const rules = [{ inboundTag: ['force-proxy-redirect', 'force-proxy-tproxy'], outboundTag: proxyTag }];
    const dd = domains(opts.directDomains), pd = domains(opts.proxyDomains);
    if (dd.length) rules.push({ domain: dd.map((d) => 'domain:' + d), outboundTag: 'direct' });
    if (opts.blockAds && bases.includes('v2fly')) rules.push({ domain: ['ext:geosite_v2fly.dat:category-ads-all'], outboundTag: 'block' });
    if (opts.blockQuic) rules.push({ network: 'udp', port: '443', outboundTag: 'block' });
    if (chosen.some((s) => s.id === 'discord') && bases.includes('zkeen')) {
      // Голосовые каналы Discord ходят по UDP на эти порты.
      rules.push({ network: 'udp', port: '19200-19400,50000-50100', ip: ['ext:zkeenip.dat:discord'], outboundTag: proxyTag });
    }
    if (pd.length) rules.push({ domain: pd.map((d) => 'domain:' + d), outboundTag: proxyTag });
    if (dom.length) rules.push({ domain: uniq(dom), outboundTag: proxyTag });
    if (ip.length) rules.push({ ip: uniq(ip), outboundTag: proxyTag });
    rules.push({ network: 'tcp,udp', outboundTag: opts.finalProxy ? proxyTag : 'direct' });

    return { routing: { domainStrategy: 'IPIfNonMatch', rules } };
  }

  // ---------- сборка ----------

  // opts: tag, services[], bases[], blockAds, blockQuic, finalProxy, proxyDomains, directDomains
  function build(proxies, opts) {
    opts = opts || {};
    const mainTag = opts.tag || 'vless-reality';
    const skipped = [];
    const outs = [];
    proxies.forEach((p) => {
      try {
        const tag = outs.length === 0 ? mainTag : mainTag + '-' + (outs.length + 1);
        outs.push(outbound(p, tag));
      } catch (e) {
        skipped.push({ name: p.name, error: e.message });
      }
    });
    if (!outs.length) throw new Error(skipped.length ? skipped[0].error : 'Добавьте хотя бы одну ссылку.');

    // Несколько серверов — балансировщик по пингу выбирает лучший.
    const multi = outs.length > 1;
    let obs = null;
    const proxyTarget = mainTag;
    if (multi) {
      obs = { observatory: { subjectSelector: [mainTag], probeUrl: 'https://www.gstatic.com/generate_204', probeInterval: '1m', enableConcurrency: true } };
    }
    outs.push({ tag: 'direct', protocol: 'freedom' });
    outs.push({ tag: 'block', protocol: 'blackhole', settings: { response: { type: 'http' } } });

    const rt = routing(opts, proxyTarget);
    if (multi) {
      // Правила на прокси ведут в балансировщик, а не в один сервер.
      rt.routing.balancers = [{ tag: 'proxy-balancer', selector: [mainTag], strategy: { type: 'leastPing' }, fallbackTag: mainTag }];
      rt.routing.rules.forEach((r) => {
        if (r.outboundTag === mainTag) { delete r.outboundTag; r.balancerTag = 'proxy-balancer'; }
      });
    }
    const files = {
      '04_outbounds.json': Object.assign({ outbounds: outs }, obs || {}),
      '05_routing.json': rt,
    };
    return { files, skipped, count: outs.length - 2 };
  }

  const api = { buildXray: build, XRAY_SERVICES: SERVICES, XRAY_BASES: BASES, xrayServiceAvailable: available };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PM = Object.assign(root.PM || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
