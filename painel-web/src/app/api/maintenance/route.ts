import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const sh = promisify(exec);
const ROOT = '/app/conan-server-root';

async function run(cmd: string) {
  try {
    const { stdout } = await sh(cmd, { timeout: 25000 });
    return stdout.trim();
  } catch (error: any) {
    return error?.stdout?.trim() || error?.stderr?.trim() || error?.message || '';
  }
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function tail(filePath: string, lines = 80) {
  return run(`tail -n ${lines} "${filePath}" 2>/dev/null || true`);
}

export async function GET() {
  const disk = await run(`df -h / | tail -n 1`);

  const backupsSize = await run(`du -sh "${ROOT}/backups_safe" 2>/dev/null | awk '{print $1}'`);
  const savedSize = await run(`du -sh "${ROOT}/server-files/ConanSandbox/Saved" 2>/dev/null | awk '{print $1}'`);
  const modsSize = await run(`du -sh "${ROOT}/server-files/ConanSandbox/Mods" 2>/dev/null | awk '{print $1}'`);
  const panelSize = await run(`du -sh "${ROOT}/painel-web" 2>/dev/null | awk '{print $1}'`);

  const latestBackups = await run(
    `find "${ROOT}/backups_safe" -maxdepth 2 -type f \\( -name "game_0.db" -o -name "game_0.db-wal" -o -name "game_0.db-shm" -o -name "SHA256SUMS.txt" \\) ` +
    `-exec ls -lh {} \\; 2>/dev/null | awk '{print $6, $7, $8, "|", $5, "|", $9}' | tail -n 60`
  );

  const backupDirs = await run(
    `find "${ROOT}/backups_safe" -maxdepth 1 -type d -name "backup*" ` +
    `-exec ls -ld {} \\; 2>/dev/null | awk '{print $6, $7, $8, "|", $9}' | tail -n 30`
  );

  const hostCronExpected = [
    '50 2 * * * /bin/bash /home/linux/backup_conan_safe.sh >> /home/linux/conan-server/backup_safe_cron.log 2>&1',
    '* * * * * /usr/bin/python3 /home/linux/conan-server/safe_restart_scheduler.py >> /home/linux/conan-server/safe_restart_scheduler_cron.log 2>&1',
    '7 * * * * /usr/bin/python3 /home/linux/conan-server/auto_update_checker.py >> /home/linux/conan-server/auto_update_checker_cron.log 2>&1'
  ].join('\n');

  const containerCrontab = await run(`crontab -l 2>/dev/null || true`);

  const backupLog = await tail(`${ROOT}/backup_safe_cron.log`, 100);
  const updateLog = await tail(`${ROOT}/auto_update_checker_cron.log`, 100);
  const restartLog = await tail(`${ROOT}/safe_restart_scheduler_cron.log`, 100);

  const conanErrors = await run(
    `docker logs --tail 400 conan-exiles-enhanced 2>&1 ` +
    `| grep -aEi "error|fail|fatal|warning|crash|database|sqlite|failed check|too old|corrupted pak" ` +
    `| tail -n 120 || true`
  );

  const modCompatibilityIssues = await run(
    `docker logs --tail 800 conan-exiles-enhanced 2>&1 ` +
    `| grep -aEi "failed check|too old|corrupted pak|out of date" ` +
    `| tail -n 80 || true`
  );

  const hasBackupScript =
    await exists('/app/backup_conan_safe.sh') ||
    await exists(`${ROOT}/backup_conan_safe.sh`) ||
    await exists('/home/linux/backup_conan_safe.sh');

  const hasBackupEvidence =
    Boolean(backupLog && backupLog.includes('FIM BACKUP SEGURO CONAN')) ||
    Boolean(latestBackups && latestBackups.includes('game_0.db')) ||
    Boolean(backupDirs && backupDirs.includes('backup_'));

  const hasUpdateScript = await exists(`${ROOT}/auto_update_checker.py`);
  const hasRestartScript = await exists(`${ROOT}/safe_restart_scheduler.py`);

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    disk,
    sizes: {
      backupsSafe: backupsSize || '-',
      saved: savedSize || '-',
      mods: modsSize || '-',
      panel: panelSize || '-'
    },
    scripts: {
      backupSafe: hasBackupScript || hasBackupEvidence,
      backupScriptFound: hasBackupScript,
      backupEvidenceFound: hasBackupEvidence,
      autoUpdate: hasUpdateScript,
      safeRestart: hasRestartScript
    },
    crontab: containerCrontab,
    cronNote: 'Crontab exibido é do container/painel. O cron real do host deve conter as rotinas esperadas abaixo.',
    hostCronExpected,
    backupDirs,
    latestBackups,
    logs: {
      backup: backupLog,
      update: updateLog,
      restart: restartLog,
      conanErrors,
      modCompatibilityIssues
    }
  });
}
