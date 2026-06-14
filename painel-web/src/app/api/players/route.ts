import { NextResponse } from 'next/server';
import dgram from 'dgram';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const sh = promisify(exec);
const ROOT = '/app/conan-server-root';
const LOG_DIR = `${ROOT}/server-files/ConanSandbox/Saved/Logs`;

function readString(buffer: Buffer, offset: number) {
  const end = buffer.indexOf(0, offset);
  if (end === -1) return { value: '', offset };
  return {
    value: buffer.toString('utf8', offset, end),
    offset: end + 1
  };
}

function queryA2S(host = 'conan-exiles-enhanced', port = 27015): Promise<any> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');

    const packet = Buffer.concat([
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
      Buffer.from('Source Engine Query\0')
    ]);

    const timer = setTimeout(() => {
      socket.close();
      resolve({
        ok: false,
        error: 'timeout',
        host,
        port,
        players: 0,
        maxPlayers: 0
      });
    }, 4000);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      socket.close();

      try {
        if (!(msg[0] === 0xff && msg[1] === 0xff && msg[2] === 0xff && msg[3] === 0xff && msg[4] === 0x49)) {
          resolve({
            ok: false,
            error: 'resposta A2S inválida',
            rawHead: msg.subarray(0, 20).toString('hex'),
            players: 0,
            maxPlayers: 0
          });
          return;
        }

        let offset = 5;

        const protocol = msg[offset];
        offset += 1;

        const name = readString(msg, offset);
        offset = name.offset;

        const map = readString(msg, offset);
        offset = map.offset;

        const folder = readString(msg, offset);
        offset = folder.offset;

        const game = readString(msg, offset);
        offset = game.offset;

        const appid = msg.readUInt16LE(offset);
        offset += 2;

        const players = msg[offset] || 0;
        const maxPlayers = msg[offset + 1] || 0;
        const bots = msg[offset + 2] || 0;

        resolve({
          ok: true,
          host,
          port,
          protocol,
          name: name.value,
          map: map.value,
          folder: folder.value,
          game: game.value,
          appid,
          players,
          maxPlayers,
          bots
        });
      } catch (error: any) {
        resolve({
          ok: false,
          error: error?.message || 'falha ao interpretar A2S',
          players: 0,
          maxPlayers: 0
        });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.close();
      resolve({
        ok: false,
        error: err.message,
        players: 0,
        maxPlayers: 0
      });
    });

    socket.send(packet, port, host);
  });
}

function extractSteamIds(text: string) {
  const matches = text.match(/STEAM:[0-9]+/g) || [];
  return matches;
}

function parseConanTimestamp(line: string) {
  // Exemplo:
  // [2026.05.31-20.47.16:572][123]...
  const m = line.match(/\[(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return null;

  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  ));
}

async function idsFromDockerLogs(since: string) {
  const cmd =
    `docker logs --since ${since} conan-exiles-enhanced 2>&1 ` +
    `| grep -aohE "STEAM:[0-9]+" ` +
    `| sort -u`;

  try {
    const { stdout } = await sh(cmd, { timeout: 20000 });
    return stdout
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function idsFromConanLogFiles(hours: number) {
  const ids = new Set<string>();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;

  try {
    const files = await fs.readdir(LOG_DIR);
    const logFiles = files
      .filter(f => f.toLowerCase().endsWith('.log') || f.toLowerCase().includes('conansandbox'))
      .map(f => path.join(LOG_DIR, f));

    for (const file of logFiles) {
      let stat;
      try {
        stat = await fs.stat(file);
      } catch {
        continue;
      }

      // Se o arquivo é muito antigo, pula.
      if (stat.mtimeMs < cutoff - 24 * 60 * 60 * 1000) continue;

      let content = '';
      try {
        content = await fs.readFile(file, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);

      for (const line of lines) {
        if (!line.includes('STEAM:')) continue;

        const ts = parseConanTimestamp(line);

        // Se tiver timestamp, respeita janela 24h/48h.
        // Se não tiver timestamp, usa o arquivo como fallback.
        if (ts && ts.getTime() < cutoff) continue;

        for (const id of extractSteamIds(line)) {
          ids.add(id);
        }
      }
    }
  } catch {
    // Sem logs acessíveis
  }

  return Array.from(ids).sort();
}

async function uniqueSteamIds(hours: number) {
  const dockerSince = `${hours}h`;

  const dockerIds = await idsFromDockerLogs(dockerSince);
  const fileIds = await idsFromConanLogFiles(hours);

  const ids = Array.from(new Set([...dockerIds, ...fileIds])).sort();

  return {
    count: ids.length,
    ids,
    sources: {
      docker: dockerIds.length,
      files: fileIds.length
    }
  };
}

export async function GET() {
  const online = await queryA2S();
  const last24h = await uniqueSteamIds(24);
  const last48h = await uniqueSteamIds(48);

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    online,
    history: {
      unique24h: last24h.count,
      unique48h: last48h.count,
      steamIds24h: last24h.ids.slice(0, 100),
      steamIds48h: last48h.ids.slice(0, 100),
      sources24h: last24h.sources,
      sources48h: last48h.sources
    }
  });
}
