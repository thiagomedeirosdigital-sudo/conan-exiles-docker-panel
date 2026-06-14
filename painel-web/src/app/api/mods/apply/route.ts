import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body?.confirm !== 'APLICAR_MODS') {
      return NextResponse.json({
        success: false,
        error: 'Confirmação inválida.'
      }, { status: 400 });
    }

    const script = String.raw`
set -e

ROOT="/app/conan-server-root"
DATA="$(date +%F_%H-%M-%S)"
BACKUP="$ROOT/backups_safe/backup_apply_mods_$DATA"

echo "===== APLICAR MODS COM SEGURANCA ====="
echo "Backup: $BACKUP"

echo ""
echo "===== CONFIG ATUAL ====="
grep -nE "^(UPDATE_ON_START|MODS)=" "$ROOT/.env" || true

echo ""
echo "===== MODLIST ANTES ====="
cat "$ROOT/server-files/ConanSandbox/Mods/modlist.txt" 2>/dev/null || true

echo ""
echo "===== CRIANDO BACKUP SEGURO ====="
mkdir -p "$BACKUP/config"

echo "Parando Conan com timeout de 120s..."
docker stop -t 120 conan-exiles-enhanced || true

echo "Removendo container antigo para evitar conflito de nome..."
docker rm -f conan-exiles-enhanced 2>/dev/null || true

echo "Copiando banco..."
cp -a "$ROOT/server-files/ConanSandbox/Saved/game_0.db"* "$BACKUP/" 2>/dev/null || true

echo "Copiando configuracoes..."
cp -a "$ROOT/.env" "$BACKUP/config/env" 2>/dev/null || true
cp -a "$ROOT/docker-compose.yml" "$BACKUP/config/docker-compose.yml" 2>/dev/null || true
cp -a "$ROOT/server-files/ConanSandbox/Saved/Config" "$BACKUP/config/Saved_Config" 2>/dev/null || true
cp -a "$ROOT/server-files/ConanSandbox/Mods/modlist.txt" "$BACKUP/config/modlist.txt" 2>/dev/null || true

echo "Gerando hashes..."
(
  cd "$BACKUP"
  find . -maxdepth 5 -type f -print0 2>/dev/null | xargs -0 sha256sum > SHA256SUMS.txt 2>/dev/null || true
)

echo ""
echo "===== RECRIANDO CONTAINER PARA RELER .env E BAIXAR MODS ====="
cd "$ROOT"
docker compose up -d --force-recreate conan-exiles-enhanced

echo ""
echo "Aguardando 90 segundos para download/start..."
sleep 90

echo ""
echo "===== STATUS ====="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "===== MODLIST DEPOIS ====="
cat "$ROOT/server-files/ConanSandbox/Mods/modlist.txt" 2>/dev/null || true

echo ""
echo "===== MODS INSTALADOS ====="
find "$ROOT/server-files/ConanSandbox/Mods" -maxdepth 2 -type f -name "*.pak" -exec ls -lh {} \; 2>/dev/null | awk '{print $5, "|", $6, $7, $8, "|", $9}' | sort || true

echo ""
echo "===== LOGS RECENTES DE MODS ====="
docker logs --tail 500 conan-exiles-enhanced 2>&1 \
  | grep -aEi "workshop|download|mod|Pippi|300|failed check|too old|incompatible|Exposing Mod|Mounting mod|Loading asset registry|LoadModInfo|Server|fatal|error" \
  | tail -n 220 || true

echo ""
echo "===== FIM APLICAR MODS COM SEGURANCA ====="
`;

    const { stdout, stderr } = await execFileAsync('/bin/bash', ['-lc', script], {
      timeout: 240000,
      maxBuffer: 1024 * 1024 * 8
    });

    const output = `${stdout || ''}\n${stderr || ''}`.trim();

    const hasBadMod = /failed check|too old|incompatible mods|corrupted pak/i.test(output);

    return NextResponse.json({
      success: !hasBadMod,
      warning: hasBadMod ? 'Um ou mais mods parecem incompatíveis. Veja os logs.' : '',
      output
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Erro ao aplicar mods com segurança.',
      output: error?.stdout || error?.stderr || ''
    }, { status: 500 });
  }
}
