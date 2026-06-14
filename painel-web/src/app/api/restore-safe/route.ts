import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import Docker from 'dockerode';

const ROOT_DIR = '/app/conan-server-root';
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups_safe');
const SAVE_DIR = path.join(ROOT_DIR, 'server-files/ConanSandbox/Saved');
const CURRENT_SAFETY_DIR = path.join(ROOT_DIR, 'backups_before_restore');
const CONAN_CONTAINER = 'conan-exiles-enhanced';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

function safeName(name: string) {
  return /^[a-zA-Z0-9_.-]+$/.test(name);
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(src: string, dst: string) {
  if (await exists(src)) {
    await fs.copyFile(src, dst);
    return true;
  }
  return false;
}

async function listSafeBackups() {
  const entries = await fs.readdir(BACKUPS_DIR, { withFileTypes: true }).catch(() => []);
  const backups = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const backupName = entry.name;
    const backupPath = path.join(BACKUPS_DIR, backupName);
    const db = path.join(backupPath, 'game_0.db');
    const wal = path.join(backupPath, 'game_0.db-wal');
    const shm = path.join(backupPath, 'game_0.db-shm');

    if (!(await exists(db))) continue;

    const dbStat = await fs.stat(db);

    backups.push({
      name: backupName,
      sizeBytes: dbStat.size,
      sizeMB: `${(dbStat.size / 1024 / 1024).toFixed(2)} MB`,
      hasDb: true,
      hasWal: await exists(wal),
      hasShm: await exists(shm),
      modifiedAt: dbStat.mtime.toISOString()
    });
  }

  backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return backups;
}

async function stopConan() {
  const container = docker.getContainer(CONAN_CONTAINER);

  try {
    const info = await container.inspect();
    if (info?.State?.Running) {
      await container.stop({ t: 120 });
    }
  } catch (error: any) {
    if (!String(error.message || '').includes('not modified')) {
      throw error;
    }
  }
}

async function startConan() {
  const container = docker.getContainer(CONAN_CONTAINER);
  await container.start().catch((error: any) => {
    if (!String(error.message || '').includes('already started')) {
      throw error;
    }
  });
}

export async function GET() {
  try {
    const backups = await listSafeBackups();

    return NextResponse.json({
      success: true,
      restoreEnabled: false,
      message: 'API de restauração segura criada. POST ainda deve ser usado somente após teste controlado.',
      backups
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao listar backups seguros.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const backupName = String(body.backupName || '');
  const confirm = String(body.confirm || '');

  if (confirm !== 'RESTAURAR_BACKUP_SEGURO') {
    return NextResponse.json(
      { success: false, error: 'Confirmação inválida. Restauração bloqueada por segurança.' },
      { status: 423 }
    );
  }

  if (!backupName || !safeName(backupName)) {
    return NextResponse.json(
      { success: false, error: 'Nome de backup inválido.' },
      { status: 400 }
    );
  }

  const backupPath = path.join(BACKUPS_DIR, backupName);
  const backupDb = path.join(backupPath, 'game_0.db');
  const backupWal = path.join(backupPath, 'game_0.db-wal');
  const backupShm = path.join(backupPath, 'game_0.db-shm');

  if (!(await exists(backupDb))) {
    return NextResponse.json(
      { success: false, error: 'Backup seguro não encontrado ou sem game_0.db.' },
      { status: 404 }
    );
  }

  const stamp = nowStamp();
  const beforeRestoreDir = path.join(CURRENT_SAFETY_DIR, `antes_restore_${stamp}`);
  const logs: string[] = [];

  try {
    await fs.mkdir(beforeRestoreDir, { recursive: true });

    logs.push('Parando Conan com timeout seguro...');
    await stopConan();

    logs.push('Salvando estado atual antes da restauração...');
    await copyIfExists(path.join(SAVE_DIR, 'game_0.db'), path.join(beforeRestoreDir, 'game_0.db'));
    await copyIfExists(path.join(SAVE_DIR, 'game_0.db-wal'), path.join(beforeRestoreDir, 'game_0.db-wal'));
    await copyIfExists(path.join(SAVE_DIR, 'game_0.db-shm'), path.join(beforeRestoreDir, 'game_0.db-shm'));

    logs.push(`Restaurando backup: ${backupName}`);
    await fs.copyFile(backupDb, path.join(SAVE_DIR, 'game_0.db'));

    if (await exists(backupWal)) {
      await fs.copyFile(backupWal, path.join(SAVE_DIR, 'game_0.db-wal'));
    } else {
      await fs.rm(path.join(SAVE_DIR, 'game_0.db-wal'), { force: true });
    }

    if (await exists(backupShm)) {
      await fs.copyFile(backupShm, path.join(SAVE_DIR, 'game_0.db-shm'));
    } else {
      await fs.rm(path.join(SAVE_DIR, 'game_0.db-shm'), { force: true });
    }

    logs.push('Ajustando permissões dos arquivos restaurados...');
    fsSync.chmodSync(path.join(SAVE_DIR, 'game_0.db'), 0o644);
    if (fsSync.existsSync(path.join(SAVE_DIR, 'game_0.db-wal'))) fsSync.chmodSync(path.join(SAVE_DIR, 'game_0.db-wal'), 0o644);
    if (fsSync.existsSync(path.join(SAVE_DIR, 'game_0.db-shm'))) fsSync.chmodSync(path.join(SAVE_DIR, 'game_0.db-shm'), 0o644);

    logs.push('Iniciando Conan novamente...');
    await startConan();

    return NextResponse.json({
      success: true,
      message: 'Backup restaurado com segurança. Aguarde o Conan terminar de subir.',
      restoredBackup: backupName,
      safetyBackupBeforeRestore: beforeRestoreDir,
      logs
    });
  } catch (error: any) {
    try {
      await startConan();
    } catch {}

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro durante restauração segura.',
        safetyBackupBeforeRestore: beforeRestoreDir,
        logs
      },
      { status: 500 }
    );
  }
}
