import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const ROOT_DIR = '/app/conan-server-root';
const ENV_PATH = path.join(ROOT_DIR, '.env');
const STATE_PATH = path.join(ROOT_DIR, 'auto_update_state.json');
const SETTINGS_PATH = path.join(ROOT_DIR, 'auto_update_settings.json');

const defaultSettings = {
  checkerAtivo: true,
  autoUpdateAtivo: true,
  avisoMinutos: 2,
  mensagemAviso: '[UPDATE] Atualização detectada no Conan ou em mods. O servidor será reiniciado em 2 minutos para atualizar com backup seguro.',
  appIdServidor: '443030',
  workshopAppId: '440900',
  cooldownMinutos: 60
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function readJsonSafe(filePath: string, fallback: any) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath: string, data: any) {
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmp, filePath);
}

async function getModIds() {
  const envContent = await fs.readFile(ENV_PATH, 'utf-8');
  const env = parseEnv(envContent);

  return String(env.MODS || '')
    .split(',')
    .map(m => m.trim())
    .filter(m => /^\d+$/.test(m));
}

async function fetchModDetails(modIds: string[]) {
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
      result: item.result
    };
  }

  return result;
}

function compareMods(currentMods: Record<string, any>, state: any) {
  const previous = state?.lastModTimes || {};
  const changed: any[] = [];

  Object.entries(currentMods).forEach(([modId, info]: any) => {
    const oldTime = Number(previous[modId] || 0);
    const newTime = Number(info.time_updated || 0);

    changed.push({
      modId,
      title: info.title || modId,
      oldTime,
      newTime,
      changed: Boolean(oldTime && newTime && newTime > oldTime),
      oldDate: oldTime ? new Date(oldTime * 1000).toLocaleString('pt-BR') : '',
      newDate: newTime ? new Date(newTime * 1000).toLocaleString('pt-BR') : ''
    });
  });

  return changed;
}

async function updateStateWithCurrentMods(currentMods: Record<string, any>, extra: any = {}) {
  const state = await readJsonSafe(STATE_PATH, {});

  state.lastCheck = new Date().toISOString();
  state.initialized = true;
  state.lastModTimes = {};
  state.lastModTitles = {};

  Object.entries(currentMods).forEach(([modId, info]: any) => {
    state.lastModTimes[modId] = Number(info.time_updated || 0);
    state.lastModTitles[modId] = info.title || modId;
  });

  Object.assign(state, extra);

  await writeJsonAtomic(STATE_PATH, state);
  return state;
}

async function callInternalApi(pathname: string, body: any) {
  const response = await fetch(`http://localhost:3000${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });

  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.details || `Falha em ${pathname}. HTTP ${response.status}`);
  }

  return data;
}

export async function GET() {
  try {
    const modIds = await getModIds();
    const state = await readJsonSafe(STATE_PATH, {});
    const settings = await readJsonSafe(SETTINGS_PATH, defaultSettings);
    const currentMods = await fetchModDetails(modIds);
    const mods = compareMods(currentMods, state);
    const changedMods = mods.filter(m => m.changed);

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      updatesFound: changedMods.length > 0,
      changedMods,
      mods,
      note: 'Checagem automática confiável disponível para mods. O jogo base é atualizado no restart por UPDATE_ON_START=true, mas o build local não foi encontrado neste container.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao verificar updates.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'update-now');

    const modIds = await getModIds();
    const currentMods = await fetchModDetails(modIds);
    const stateBefore = await readJsonSafe(STATE_PATH, {});
    const modsBefore = compareMods(currentMods, stateBefore);
    const changedMods = modsBefore.filter(m => m.changed);

    if (action === 'check') {
      return NextResponse.json({
        success: true,
        updatesFound: changedMods.length > 0,
        changedMods,
        mods: modsBefore
      });
    }

    if (action !== 'update-now') {
      return NextResponse.json(
        { success: false, error: 'Ação inválida.' },
        { status: 400 }
      );
    }

    const settings = await readJsonSafe(SETTINGS_PATH, defaultSettings);
    const avisoMinutos = Math.max(0, Math.min(10, Number(body.avisoMinutos ?? settings.avisoMinutos ?? 2)));
    const mensagemAviso = String(body.mensagemAviso || settings.mensagemAviso || defaultSettings.mensagemAviso);

    const logs: string[] = [];

    logs.push('Enviando aviso RCON...');
    try {
      const rcon = await callInternalApi('/api/rcon', { mensagem: mensagemAviso });
      logs.push(`RCON OK: ${rcon.respostaLog || 'enviado'}`);
    } catch (error: any) {
      logs.push(`RCON falhou, seguindo com segurança: ${error.message}`);
    }

    if (avisoMinutos > 0) {
      logs.push(`Aguardando ${avisoMinutos} minuto(s) antes do reinício...`);
      await sleep(avisoMinutos * 60 * 1000);
    }

    logs.push('Executando Reinício Seguro...');
    const restart = await callInternalApi('/api/safe-restart', {});

    logs.push(`Reinício Seguro OK. Backup: ${restart.backup || 'não informado'}`);

    const currentAfter = await fetchModDetails(modIds);
    const newState = await updateStateWithCurrentMods(currentAfter, {
      lastAction: 'manual_update_now',
      lastManualUpdate: new Date().toISOString(),
      lastManualUpdateBackup: restart.backup || '',
      lastDetectedReasons: changedMods.map(m => `Mod atualizado: ${m.title} (${m.modId})`)
    });

    return NextResponse.json({
      success: true,
      message: 'Atualização segura executada. Aguarde o Conan terminar de subir e validar mods.',
      updatesFoundBeforeRun: changedMods.length > 0,
      changedMods,
      backup: restart.backup,
      logs,
      safeRestart: restart
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao executar atualização segura.' },
      { status: 500 }
    );
  }
}
