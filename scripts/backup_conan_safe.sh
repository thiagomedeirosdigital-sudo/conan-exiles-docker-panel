#!/bin/bash
set -u

PROJECT_DIR="/home/linux/conan-server"
SAVE_DIR="$PROJECT_DIR/server-files/ConanSandbox/Saved"
BACKUP_ROOT="$PROJECT_DIR/backups_safe"
LOG_FILE="$PROJECT_DIR/backup_safe.log"
LOCK_FILE="/tmp/conan_backup_safe.lock"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="$BACKUP_ROOT/backup_$DATE"

log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $*" | tee -a "$LOG_FILE"
}

if [ -e "$LOCK_FILE" ]; then
  log "ERRO: Ja existe backup/manutencao em andamento: $LOCK_FILE"
  exit 1
fi

touch "$LOCK_FILE"

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

log "===== INICIO BACKUP SEGURO CONAN ====="

mkdir -p "$BACKUP_DIR"

if [ ! -f "$SAVE_DIR/game_0.db" ]; then
  log "ERRO CRITICO: game_0.db nao encontrado em $SAVE_DIR"
  exit 1
fi

log "Status antes do backup:"
docker ps -a --format "table {{.Names}}\t{{.Status}}" | tee -a "$LOG_FILE"

log "Parando container conan-exiles-enhanced com timeout de 120s..."
if ! docker stop -t 120 conan-exiles-enhanced >> "$LOG_FILE" 2>&1; then
  log "ERRO: Falha ao parar container. Abortando backup."
  exit 1
fi

log "Copiando arquivos do banco..."
cp -a "$SAVE_DIR/game_0.db" "$BACKUP_DIR/game_0.db"

if [ -f "$SAVE_DIR/game_0.db-wal" ]; then
  cp -a "$SAVE_DIR/game_0.db-wal" "$BACKUP_DIR/game_0.db-wal"
fi

if [ -f "$SAVE_DIR/game_0.db-shm" ]; then
  cp -a "$SAVE_DIR/game_0.db-shm" "$BACKUP_DIR/game_0.db-shm"
fi

log "Copiando configuracoes importantes..."
mkdir -p "$BACKUP_DIR/config"
cp -a "$PROJECT_DIR/.env" "$BACKUP_DIR/config/env" 2>/dev/null || true
cp -a "$PROJECT_DIR/docker-compose.yml" "$BACKUP_DIR/config/docker-compose.yml" 2>/dev/null || true

if [ -d "$PROJECT_DIR/server-files/ConanSandbox/Saved/Config" ]; then
  cp -a "$PROJECT_DIR/server-files/ConanSandbox/Saved/Config" "$BACKUP_DIR/config/Saved_Config"
fi

log "Gerando hashes..."
sha256sum "$BACKUP_DIR"/game_0.db* > "$BACKUP_DIR/SHA256SUMS.txt" 2>/dev/null || true

log "Listando backup criado:"
find "$BACKUP_DIR" -maxdepth 3 -type f -printf "%p | %s bytes | %TY-%Tm-%Td %TH:%TM\n" | sort | tee -a "$LOG_FILE"

log "Iniciando container novamente..."
if ! docker start conan-exiles-enhanced >> "$LOG_FILE" 2>&1; then
  log "ERRO CRITICO: Backup foi criado, mas falhou ao iniciar o container."
  exit 1
fi

log "Aguardando 20s..."
sleep 20

log "Status apos backup:"
docker ps -a --format "table {{.Names}}\t{{.Status}}" | tee -a "$LOG_FILE"

log "Aplicando retencao de 14 dias em $BACKUP_ROOT..."
find "$BACKUP_ROOT" -maxdepth 1 -type d -name "backup_*" -mtime +14 -print -exec rm -rf {} \; | tee -a "$LOG_FILE"

log "===== FIM BACKUP SEGURO CONAN ====="
