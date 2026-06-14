import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const ROOT_DIR = '/app/conan-server-root';
const SAFE_BACKUP_DIR = path.join(ROOT_DIR, 'backups_safe');
const SAVE_DIR = path.join(ROOT_DIR, 'server-files/ConanSandbox/Saved');
const CONFIG_DIR = path.join(ROOT_DIR, 'server-files/ConanSandbox/Saved/Config');
const LOCK_FILE = '/tmp/conan_safe_restart.lock';
const CONTAINER_NAME = 'conan-exiles-enhanced';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function copyIfExists(source: string, target: string) {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
    return true;
  }
  return false;
}

function createBackupStopped(log: string[]) {
  if (!fs.existsSync(path.join(SAVE_DIR, 'game_0.db'))) {
    throw new Error(`game_0.db não encontrado em ${SAVE_DIR}`);
  }

  const backupName = `backup_restart_${timestamp()}`;
  const backupDir = path.join(SAFE_BACKUP_DIR, backupName);
  const configBackupDir = path.join(backupDir, 'config');

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(configBackupDir, { recursive: true });

  log.push('Copiando banco do Conan...');
  copyIfExists(path.join(SAVE_DIR, 'game_0.db'), path.join(backupDir, 'game_0.db'));
  copyIfExists(path.join(SAVE_DIR, 'game_0.db-wal'), path.join(backupDir, 'game_0.db-wal'));
  copyIfExists(path.join(SAVE_DIR, 'game_0.db-shm'), path.join(backupDir, 'game_0.db-shm'));

  log.push('Copiando configurações...');
  copyIfExists(path.join(ROOT_DIR, '.env'), path.join(configBackupDir, 'env'));
  copyIfExists(path.join(ROOT_DIR, 'docker-compose.yml'), path.join(configBackupDir, 'docker-compose.yml'));

  if (fs.existsSync(CONFIG_DIR)) {
    fs.cpSync(CONFIG_DIR, path.join(configBackupDir, 'Saved_Config'), { recursive: true });
  }

  log.push('Gerando hashes...');
  const hashLines: string[] = [];
  for (const file of ['game_0.db', 'game_0.db-wal', 'game_0.db-shm']) {
    const filePath = path.join(backupDir, file);
    if (fs.existsSync(filePath)) {
      hashLines.push(`${sha256File(filePath)}  ${file}`);
    }
  }

  fs.writeFileSync(path.join(backupDir, 'SHA256SUMS.txt'), hashLines.join('\n') + '\n');

  log.push(`Backup pré-reinício criado: ${backupName}`);
  return backupName;
}

export async function POST() {
  const log: string[] = [];
  let stopped = false;

  try {
    if (fs.existsSync(LOCK_FILE)) {
      return NextResponse.json(
        { success: false, error: 'Já existe reinício seguro em andamento. Aguarde finalizar.' },
        { status: 423 }
      );
    }

    fs.writeFileSync(LOCK_FILE, String(Date.now()));

    const container = docker.getContainer(CONTAINER_NAME);

    log.push('Parando Conan com timeout de 120 segundos...');
    try {
      await container.stop({ t: 120 });
      stopped = true;
      log.push('Conan parado com sucesso.');
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.includes('already stopped') || msg.includes('304')) {
        stopped = true;
        log.push('Conan já estava parado.');
      } else {
        throw error;
      }
    }

    const backupName = createBackupStopped(log);

    log.push('Iniciando Conan novamente...');
    await container.start();
    stopped = false;

    log.push('Conan iniciado com sucesso.');
    log.push('Aguarde alguns minutos para o servidor terminar mods/validação e aparecer no jogo.');

    return NextResponse.json({
      success: true,
      message: 'Reinício seguro executado com sucesso.',
      backup: backupName,
      stdout: log.join('\n')
    });
  } catch (error: any) {
    log.push(`ERRO: ${error.message || String(error)}`);

    if (stopped) {
      try {
        log.push('Tentando religar Conan após erro...');
        const container = docker.getContainer(CONTAINER_NAME);
        await container.start();
        log.push('Conan religado.');
      } catch (startError: any) {
        log.push(`ERRO CRÍTICO AO RELIGAR: ${startError.message || String(startError)}`);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Falha no reinício seguro.',
        details: error.message || String(error),
        stdout: log.join('\n')
      },
      { status: 500 }
    );
  } finally {
    try {
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch {}
  }
}
