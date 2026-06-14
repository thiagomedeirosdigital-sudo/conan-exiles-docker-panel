import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const rootPath = '/app/conan-server-root';
const envPath = path.join(rootPath, '.env');
const serverSettingsPath = path.join(
  rootPath,
  'server-files/ConanSandbox/Saved/Config/LinuxServer/ServerSettings.ini'
);

function parseKeyValueFile(content: string) {
  const config: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('[')) return;

    const firstEquals = trimmed.indexOf('=');
    if (firstEquals !== -1) {
      const key = trimmed.substring(0, firstEquals).trim();
      const value = trimmed.substring(firstEquals + 1).trim();
      config[key] = value;
    }
  });

  return config;
}

function updateKeyValueContent(
  content: string,
  updates: Record<string, string>,
  caseSensitive = true
) {
  const lines = content.split('\n');
  const found = new Set<string>();

  const normalize = (key: string) => caseSensitive ? key : key.toLowerCase();

  const updateMap: Record<string, { originalKey: string; value: string }> = {};
  Object.entries(updates).forEach(([key, value]) => {
    updateMap[normalize(key)] = { originalKey: key, value };
  });

  const newLines = lines.map(line => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('[')) {
      return line;
    }

    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) return line;

    const key = trimmed.substring(0, firstEquals).trim();
    const normalizedKey = normalize(key);

    if (updateMap[normalizedKey]) {
      found.add(normalizedKey);
      return `${key}=${updateMap[normalizedKey].value}`;
    }

    return line;
  });

  Object.entries(updateMap).forEach(([normalizedKey, item]) => {
    if (!found.has(normalizedKey)) {
      newLines.push(`${item.originalKey}=${item.value}`);
    }
  });

  return newLines.join('\n').replace(/\n*$/, '\n');
}

function cleanString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\r\n]/g, ' ').trim();
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeMods(value: unknown) {
  if (!Array.isArray(value)) return '';

  return value
    .map(v => String(v).trim())
    .filter(v => /^\d+$/.test(v))
    .join(',');
}

export async function GET() {
  try {
    const envContent = await fs.readFile(envPath, 'utf-8');
    const envConfig = parseKeyValueFile(envContent);

    let iniConfig: Record<string, string> = {};
    if (fsSync.existsSync(serverSettingsPath)) {
      const iniContent = await fs.readFile(serverSettingsPath, 'utf-8');
      iniConfig = parseKeyValueFile(iniContent);
    }

    return NextResponse.json({
      serverName: envConfig['SERVER_NAME'] || iniConfig['ServerName'] || 'Não definido',
      adminPassword: envConfig['ADMIN_PASSWORD'] || iniConfig['AdminPassword'] || '',
      rconPassword: envConfig['RCON_PASSWORD'] || '',
      maxPlayers: parseInt(envConfig['MAX_PLAYERS'] || iniConfig['MaxPlayers'] || '20', 10),
      serverRegion: envConfig['SERVER_REGION'] || iniConfig['serverRegion'] || '4',
      maxNudity: envConfig['MaxNudity'] || iniConfig['MaxNudity'] || '2',
      nudityLevel: envConfig['NudityLevel'] || iniConfig['NudityLevel'] || '2',
      mods: envConfig['MODS'] ? envConfig['MODS'].split(',').filter(Boolean) : []
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao ler configurações', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const serverName = cleanString(body.serverName);
    const adminPassword = cleanString(body.adminPassword);
    const rconPassword = cleanString(body.rconPassword);
    const maxPlayers = cleanNumber(body.maxPlayers, 20, 1, 100);
    const serverRegion = cleanString(body.serverRegion || '4');
    const maxNudity = cleanString(body.maxNudity || body.nudityLevel || '2');
    const nudityLevel = cleanString(body.nudityLevel || body.maxNudity || '2');
    const mods = normalizeMods(body.mods);

    if (!/^[0-5]$/.test(serverRegion)) {
      return NextResponse.json({ error: 'Região inválida. Use valor entre 0 e 5.' }, { status: 400 });
    }

    if (!/^[0-2]$/.test(maxNudity)) {
      return NextResponse.json({ error: 'Nudez inválida. Use 0, 1 ou 2.' }, { status: 400 });
    }

    const envContent = await fs.readFile(envPath, 'utf-8');

    const envUpdates: Record<string, string> = {
      SERVER_NAME: serverName,
      ADMIN_PASSWORD: adminPassword,
      RCON_PASSWORD: rconPassword,
      MAX_PLAYERS: String(maxPlayers),
      SERVER_REGION: serverRegion,
      MaxNudity: maxNudity,
      NudityLevel: nudityLevel,
      MODS: mods
    };

    const newEnvContent = updateKeyValueContent(envContent, envUpdates, true);
    await fs.writeFile(envPath, newEnvContent, 'utf-8');

    if (fsSync.existsSync(serverSettingsPath)) {
      const iniContent = await fs.readFile(serverSettingsPath, 'utf-8');

      const iniUpdates: Record<string, string> = {
        ServerName: serverName,
        AdminPassword: adminPassword,
        MaxPlayers: String(maxPlayers),
        serverRegion: serverRegion,
        MaxNudity: maxNudity,
        NudityLevel: nudityLevel
      };

      const newIniContent = updateKeyValueContent(iniContent, iniUpdates, false);
      await fs.writeFile(serverSettingsPath, newIniContent, 'utf-8');
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas em .env e ServerSettings.ini. Reinicie o Conan para aplicar totalmente.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao salvar configurações', details: error.message },
      { status: 500 }
    );
  }
}
