// Тесты разбора ссылок и сборки конфигов: node --test tools/test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLink, parseText } = require('../lib/links.js');
const { buildXray } = require('../lib/xray.js');
const { buildMihomo } = require('../lib/mihomo.js');

const REALITY = 'vless://5f2c1e7a-0b3d-4c6e-9a8f-1234567890ab@203.0.113.10:443?type=tcp&security=reality&pbk=Fj98Liz-8fJCAaK_hcsGDJRSd9ztkw0TDR2v4kqK7TA&fp=chrome&sni=www.microsoft.com&sid=2831cdcf4a278ac2&spx=%2F&flow=xtls-rprx-vision#%D0%93%D0%B5%D1%80%D0%BC%D0%B0%D0%BD%D0%B8%D1%8F';
const WS_TLS = 'vless://11111111-2222-3333-4444-555555555555@cdn.example.com:443?type=ws&security=tls&path=%2Fws%3Fed%3D2048&host=cdn.example.com&sni=cdn.example.com&alpn=h2%2Chttp%2F1.1#ws';
const XHTTP = 'vless://11111111-2222-3333-4444-555555555555@x.example.com:443?type=xhttp&security=reality&pbk=abc&sid=01&sni=www.apple.com&path=%2Fx&mode=packet-up#xhttp';
const GRPC = 'trojan://p%40ss@t.example.com:443?type=grpc&serviceName=gun&security=tls&sni=t.example.com#grpc';
const VMESS = 'vmess://' + Buffer.from(JSON.stringify({ v: '2', ps: 'vm', add: 'v.example.com', port: '8443', id: '11111111-2222-3333-4444-555555555555', aid: '0', scy: 'auto', net: 'ws', host: 'v.example.com', path: '/vm', tls: 'tls', sni: 'v.example.com' })).toString('base64');
const SS_B64 = 'ss://' + Buffer.from('chacha20-ietf-poly1305:secret').toString('base64url') + '@198.51.100.7:8388#ss';
const SS_2022 = 'ss://2022-blake3-aes-128-gcm:YctPZ6U7xPPcU%2Bgp3u%2B0tx%2FtRizJN9K8y%2BuKlW2qjlI%3D@198.51.100.8:443#ss22';
const SS_OLD = 'ss://' + Buffer.from('aes-256-gcm:pw@198.51.100.9:1234').toString('base64') + '#old';
const HY2 = 'hy2://admin:9c1e5b@hy.example.com:443/?sni=hy.example.com&insecure=1&pinSHA256=AB:CD:EF&obfs=salamander&obfs-password=x#hy';

test('REALITY', () => {
  const p = parseLink(REALITY);
  assert.equal(p.type, 'vless');
  assert.equal(p.name, 'Германия');
  assert.equal(p.tls.security, 'reality');
  assert.equal(p.tls.pbk, 'Fj98Liz-8fJCAaK_hcsGDJRSd9ztkw0TDR2v4kqK7TA');
  assert.equal(p.tls.spx, '/');
  assert.equal(p.flow, 'xtls-rprx-vision');
});

test('WS + TLS с путём и ALPN', () => {
  const p = parseLink(WS_TLS);
  assert.equal(p.transport.path, '/ws?ed=2048');
  assert.deepEqual(p.tls.alpn, ['h2', 'http/1.1']);
});

test('xhttp, gRPC trojan, vmess', () => {
  assert.equal(parseLink(XHTTP).transport.mode, 'packet-up');
  const g = parseLink(GRPC);
  assert.equal(g.password, 'p@ss');
  assert.equal(g.transport.serviceName, 'gun');
  const v = parseLink(VMESS);
  assert.equal(v.port, 8443);
  assert.equal(v.transport.path, '/vm');
});

test('Shadowsocks во всех трёх форматах', () => {
  assert.equal(parseLink(SS_B64).method, 'chacha20-ietf-poly1305');
  assert.equal(parseLink(SS_2022).password, 'YctPZ6U7xPPcU+gp3u+0tx/tRizJN9K8y+uKlW2qjlI=');
  const o = parseLink(SS_OLD);
  assert.equal(o.server, '198.51.100.9');
  assert.equal(o.port, 1234);
});

test('Hysteria2: логин:пароль и отпечаток', () => {
  const h = parseLink(HY2);
  assert.equal(h.password, 'admin:9c1e5b');
  assert.equal(h.pinSHA256, 'abcdef');
  assert.equal(h.obfs, 'salamander');
});

test('подписка в base64 и ошибки по строкам', () => {
  const sub = Buffer.from([REALITY, 'garbage', 'tuic://x@y:1', HY2].join('\n')).toString('base64');
  const r = parseText(sub);
  assert.equal(r.proxies.length, 2);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors[1].error, /tuic/);
});

test('одинаковые имена становятся уникальными', () => {
  const r = parseText(REALITY + '\n' + REALITY);
  assert.deepEqual(r.proxies.map((p) => p.name), ['Германия', 'Германия 2']);
});

test('битые ссылки дают понятную ошибку', () => {
  assert.throws(() => parseLink('vless://@h:443'), /UUID/);
  assert.throws(() => parseLink('vless://id@h:443?security=reality'), /pbk/);
  assert.throws(() => parseLink('hy2://pw@h:443-500'), /диапазон/);
  assert.throws(() => parseLink('vless://id@h:99999'), /порт|Invalid/);
});

test('Xray: теги, балансировщик и маршрутизация', () => {
  const one = buildXray(parseText(REALITY).proxies, {});
  assert.equal(one.files['04_outbounds.json'].outbounds[0].tag, 'vless-reality');
  assert.equal(one.files['04_outbounds.json'].outbounds[0].streamSettings.realitySettings.publicKey, 'Fj98Liz-8fJCAaK_hcsGDJRSd9ztkw0TDR2v4kqK7TA');
  const rules = one.files['05_routing.json'].routing.rules;
  assert.equal(rules[rules.length - 1].outboundTag, 'direct');
  const multi = buildXray(parseText([REALITY, WS_TLS, HY2].join('\n')).proxies, {});
  assert.equal(multi.count, 2);
  assert.equal(multi.skipped.length, 1);
  assert.ok(multi.files['05_routing.json'].routing.balancers);
});

test('Xray: сервисы без нужной геобазы не попадают в правила', () => {
  const r = buildXray(parseText(REALITY).proxies, { bases: ['zkeen'], services: ['twitter', 'youtube'] });
  const s = JSON.stringify(r.files['05_routing.json']);
  assert.ok(!s.includes('twitter'));
  assert.ok(s.includes('ext:zkeen.dat:youtube'));
});

test('Mihomo: порты XKeen и прокси', () => {
  const r = buildMihomo(parseText([REALITY, HY2, SS_2022].join('\n')).proxies, { secret: 'x' });
  assert.equal(r.config['redir-port'], 5000);
  assert.equal(r.config['tproxy-port'], 5001);
  assert.equal(r.config['routing-mark'], 255);
  assert.equal(r.config.proxies.length, 3);
  assert.equal(r.config.proxies[1].fingerprint, 'abcdef');
  assert.match(r.yaml, /name: "Германия"/);
});
