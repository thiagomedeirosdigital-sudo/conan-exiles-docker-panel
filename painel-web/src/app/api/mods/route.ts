import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = '/app/conan-server-root';
const ENV_PATH = path.join(ROOT_DIR, '.env');
const MODS_DIR = path.join(ROOT_DIR, 'server-files/ConanSandbox/Mods');
const MODLIST_PATH = path.join(MODS_DIR, 'modlist.txt');

function parseEnv(content: string) {
  const env: Record<string, string> = {};

  content.split('\n').forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || !clean.includes('=')) return;

    const [key, ...rest] = clean.split('=');
    env[key.trim()] = rest.join('=').trim();
  });

  return env;
}

function getModIdsFromEnv(content: string) {
  const env = parseEnv(content);

  return String(env.MODS || '')
    .split(',')
    .map(x => x.trim())
    .filter(x => /^\d+$/.test(x));
}

async function readTextSafe(filePath: string) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

async function fetchSteamDetails(modIds: string[]) {
  if (!modIds.length) return {};

  const params = new URLSearchParams();
  params.append('itemcount', String(modIds.length));

  modIds.forEach((id, index) => {
    params.append(`publishedfileids[${index}]`, id);
  });

  const response = await fetch('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar Steam Workshop. HTTP ${response.status}`);
  }

  const data = await response.json();
  const result: Record<string, any> = {};

  for (const item of data?.response?.publishedfiledetails || []) {
    const modId = String(item.publishedfileid || '');
    if (!modId) continue;

    result[modId] = {
      modId,
      title: item.title || modId,
      time_updated: Number(item.time_updated || 0),
      updatedAt: item.time_updated ? new Date(Number(item.time_updated) * 1000).toLocaleString('pt-BR') : '',
      result: item.result
    };
  }

  return result;
}

function parseModlistLines(content: string) {
  const map: Record<string, string> = {};
  const lines = content
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match =
      line.match(/\/Mods\/(\d+)\//) ||
      line.match(/Mods[\\/](\d+)[\\/]/) ||
      line.match(/^[*+]?(\d+)[\\/]/);

    if (match?.[1]) {
      map[match[1]] = line;
    }
  }

  return { lines, map };
}

async function findPakLineForMod(modId: string, existingLine?: string) {
  if (existingLine) return existingLine;

  const modDir = path.join(MODS_DIR, modId);

  try {
    const files = await fs.readdir(modDir);
    const pak = files.find(f => f.toLowerCase().endsWith('.pak'));

    if (pak) {
      return `/home/steam/server-files/ConanSandbox/Mods/${modId}/${pak}`;
    }
  } catch {}

  return `/home/steam/server-files/ConanSandbox/Mods/${modId}/${modId}.pak`;
}

async function buildModsList() {
  const envContent = await readTextSafe(ENV_PATH);
  const modlistContent = await readTextSafe(MODLIST_PATH);
  const modIds = getModIdsFromEnv(envContent);
  const { map } = parseModlistLines(modlistContent);
  const steam = await fetchSteamDetails(modIds);

  const mods = modIds.map((modId, index) => ({
    modId,
    order: index + 1,
    title: steam[modId]?.title || modId,
    updatedAt: steam[modId]?.updatedAt || '',
    time_updated: steam[modId]?.time_updated || 0,
    modlistLine: map[modId] || '',
    hasModlistLine: Boolean(map[modId])
  }));

  return { mods, modIds, steam };
}

function updateEnvMods(envContent: string, modIds: string[]) {
  const newLine = `MODS=${modIds.join(',')}`;

  if (/^MODS=.*$/m.test(envContent)) {
    return envContent.replace(/^MODS=.*$/m, newLine);
  }

  return envContent.trimEnd() + '\n' + newLine + '\n';
}

export async function GET() {
  try {
    const data = await buildModsList();

    return NextResponse.json({
      success: true,
      mods: data.mods,
      count: data.mods.length,
      note: 'A ordem exibida é a ordem de carregamento. Salvar altera .env e modlist.txt.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao listar mods.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'save-order');

    if (action !== 'save-order') {
      return NextResponse.json(
        { success: false, error: 'Ação inválida.' },
        { status: 400 }
      );
    }

    const modIds = Array.isArray(body.modIds)
      ? body.modIds.map((x: any) => String(x).trim()).filter((x: string) => /^\d+$/.test(x))
      : [];

    if (!modIds.length) {
      return NextResponse.json(
        { success: false, error: 'Lista de mods vazia ou inválida.' },
        { status: 400 }
      );
    }

    if (new Set(modIds).size !== modIds.length) {
      return NextResponse.json(
        { success: false, error: 'Lista de mods contém IDs duplicados.' },
        { status: 400 }
      );
    }

    const envContent = await readTextSafe(ENV_PATH);
    const modlistContent = await readTextSafe(MODLIST_PATH);
    const { map } = parseModlistLines(modlistContent);

    const newEnv = updateEnvMods(envContent, modIds);
    const newLines: string[] = [];

    for (const modId of modIds) {
      newLines.push(await findPakLineForMod(modId, map[modId]));
    }

    await fs.writeFile(ENV_PATH, newEnv, 'utf-8');
    await fs.writeFile(MODLIST_PATH, newLines.join('\n') + '\n', 'utf-8');

    const result = await buildModsList();

    return NextResponse.json({
      success: true,
      message: 'Ordem dos mods salva em .env e modlist.txt. Use Reinício Seguro para aplicar totalmente.',
      mods: result.mods
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao salvar ordem dos mods.' },
      { status: 500 }
    );
  }
}
