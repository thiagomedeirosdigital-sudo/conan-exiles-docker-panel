import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function run(cmd: string, timeout = 12000) {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout,
      maxBuffer: 1024 * 1024 * 4
    });

    return {
      ok: true,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error: any) {
    return {
      ok: false,
      stdout: error?.stdout?.trim?.() || '',
      stderr: error?.stderr?.trim?.() || error?.message || ''
    };
  }
}

async function getPublicIp() {
  const urls = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com'
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeout);

      const text = (await res.text()).trim();

      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) {
        return text;
      }
    } catch {}
  }

  const curlFallback = await run(
    `curl -s --max-time 8 https://api.ipify.org || curl -s --max-time 8 https://ifconfig.me/ip || curl -s --max-time 8 https://icanhazip.com || true`
  );

  const ip = curlFallback.stdout.trim();

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip;
  }

  return '';
}

function hasUdpPort(text: string, port: number) {
  if (new RegExp(`:${port}->${port}/udp`).test(text)) return true;
  if (new RegExp(`${port}->${port}/udp`).test(text)) return true;
  if (new RegExp(`7777-7778->7777-7778/udp`).test(text) && (port === 7777 || port === 7778)) return true;
  if (new RegExp(`:${port}\\s`).test(text)) return true;
  return false;
}

function hasTcpPort(text: string, port: number) {
  if (new RegExp(`:${port}->${port}/tcp`).test(text)) return true;
  if (new RegExp(`${port}->${port}/tcp`).test(text)) return true;
  if (new RegExp(`:${port}\\s`).test(text)) return true;
  return false;
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  const publicIp = await getPublicIp();

  const dockerPorts = await run(
    `docker ps --filter name=conan-exiles-enhanced --format "{{.Names}} {{.Status}} {{.Ports}}"`
  );

  const ssPorts = await run(
    `ss -tulpen 2>/dev/null | grep -E "7777|7778|27015|25575" || true`
  );

  let players: any = null;
  let playersApiError = '';

  try {
    const res = await fetch('http://127.0.0.1:3000/api/players', {
      cache: 'no-store'
    });

    players = await res.json();
  } catch (error: any) {
    playersApiError = error?.message || 'Falha ao consultar /api/players';
    players = null;
  }

  const portsText = `${dockerPorts.stdout}\n${ssPorts.stdout}`;

  const checks = {
    dockerOnline: /conan-exiles-enhanced/.test(dockerPorts.stdout) && /Up/.test(dockerPorts.stdout),

    udp7777Mapped: hasUdpPort(portsText, 7777),
    udp7778Mapped: hasUdpPort(portsText, 7778),
    udp27015Mapped: hasUdpPort(portsText, 27015),
    tcp25575Mapped: hasTcpPort(portsText, 25575),

    steamQueryLocalOk: Boolean(players?.online?.ok),
    steamQueryLocalError: players?.online?.error || '',
    playersOnline: players?.online?.players ?? 0,
    maxPlayers: players?.online?.maxPlayers ?? 0,
    serverName: players?.online?.name || '',
    map: players?.online?.map || ''
  };

  const localOk =
    checks.dockerOnline &&
    checks.udp7777Mapped &&
    checks.udp7778Mapped &&
    checks.udp27015Mapped &&
    checks.steamQueryLocalOk;

  const possibleIssues = [];

  if (!checks.dockerOnline) {
    possibleIssues.push('Container do Conan não está online.');
  }

  if (!checks.udp7777Mapped || !checks.udp7778Mapped || !checks.udp27015Mapped) {
    possibleIssues.push('Uma ou mais portas UDP principais não aparecem mapeadas no Docker.');
  }

  if (!checks.steamQueryLocalOk) {
    possibleIssues.push('O servidor ainda não respondeu ao Steam Query local. Pode estar iniciando, travado ou com porta/query indisponível.');
  }

  if (!publicIp) {
    possibleIssues.push('Não foi possível detectar o IP público pelo painel. Pode ser falta de saída HTTP no container ou bloqueio de DNS/rede.');
  }

  possibleIssues.push(
    'O teste local não confirma 100% se a operadora liberou entrada externa. Para isso, compare com teste fora da sua rede ou com IP WAN do roteador.'
  );

  return NextResponse.json({
    success: true,
    checkedAt,
    publicIp,
    localOk,
    externalTcpInference: {
      enabled: true,
      explanation:
        'Se uma porta TCP de entrada não funcionar externamente, é forte indício de bloqueio/CGNAT. Se TCP funcionar, ainda é recomendado validar UDP do Conan.'
    },
    checks,
    raw: {
      dockerPorts: dockerPorts.stdout,
      ssPorts: ssPorts.stdout,
      playersApi: players,
      playersApiError
    },
    portsExpected: [
      { port: 7777, protocol: 'UDP', purpose: 'Jogo Conan' },
      { port: 7778, protocol: 'UDP', purpose: 'Jogo Conan' },
      { port: 27015, protocol: 'UDP', purpose: 'Steam Query / listagem' },
      { port: 25575, protocol: 'TCP', purpose: 'RCON / administração protegido em localhost' }
    ],
    manualExternalTests: [
      'Teste pelo celular no 4G/5G, fora do Wi-Fi, tentando localizar/conectar no servidor.',
      'Compare o IP público mostrado aqui com o IP WAN/Internet do roteador.',
      'Se o IP WAN do roteador começar com 100.64.x.x, 10.x.x.x, 172.16-31.x.x ou 192.168.x.x, provavelmente há CGNAT.',
      'Teste TCP externo ajuda como indício: se TCP não entra, provavelmente UDP também não entrará pela operadora.'
    ],
    possibleIssues
  });
}
