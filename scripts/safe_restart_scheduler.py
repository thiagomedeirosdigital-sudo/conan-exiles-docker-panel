#!/usr/bin/env python3
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta

BASE = "/home/linux/conan-server"
CONFIG_PATH = os.path.join(BASE, "cron_settings.json")
STATE_PATH = os.path.join(BASE, "safe_restart_state.json")
LOG_PATH = os.path.join(BASE, "safe_restart_scheduler.log")

RCON_URL = "http://localhost:3000/api/rcon"
SAFE_RESTART_URL = "http://localhost:3000/api/safe-restart"


def log(msg: str):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: str, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)


def post_json(url: str, payload=None, timeout=30):
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, body


def send_rcon(message: str):
    if not message.strip():
        return

    try:
        status, body = post_json(RCON_URL, {"mensagem": message}, timeout=20)
        log(f"RCON enviado. HTTP={status}. Resposta={body[:300]}")
    except Exception as e:
        log(f"Falha ao enviar RCON: {e}")


def run_safe_restart():
    try:
        status, body = post_json(SAFE_RESTART_URL, {}, timeout=900)
        log(f"Reinício seguro chamado. HTTP={status}. Resposta={body[:800]}")
        return 200 <= status < 300
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        log(f"Falha HTTP no reinício seguro: HTTP={e.code}. {body[:800]}")
        return False
    except Exception as e:
        log(f"Falha ao chamar reinício seguro: {e}")
        return False


def parse_hhmm(value: str):
    try:
        hh, mm = value.strip().split(":")
        return int(hh), int(mm)
    except Exception:
        raise ValueError(f"horaRestart inválida: {value!r}")


def main():
    cfg = load_json(CONFIG_PATH, {})
    state = load_json(STATE_PATH, {})

    if not cfg.get("restartAtivo", False):
        return

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")

    hora = str(cfg.get("horaRestart", "03:00"))
    h, m = parse_hhmm(hora)

    restart_time = now.replace(hour=h, minute=m, second=0, microsecond=0)

    # Se passou muito do horário, evita ficar tentando reiniciar fora da janela.
    minutes_until = int((restart_time - now).total_seconds() // 60)

    aviso1 = int(cfg.get("tempoAviso1", 10))
    aviso2 = int(cfg.get("tempoAviso2", 5))
    msg1 = str(cfg.get("mensagem1", "Servidor reinicia em breve."))
    msg2 = str(cfg.get("mensagem2", "Servidor reinicia em poucos minutos."))

    key_warn1 = f"{today}_warn1"
    key_warn2 = f"{today}_warn2"
    key_restart = f"{today}_restart"

    # Janela de tolerância: como cron roda por minuto, aceitamos igualdade exata.
    if minutes_until == aviso1 and state.get(key_warn1) != True:
        log(f"Enviando aviso 1. Faltam {aviso1} minutos.")
        send_rcon(msg1)
        state[key_warn1] = True
        save_json(STATE_PATH, state)
        return

    if minutes_until == aviso2 and state.get(key_warn2) != True:
        log(f"Enviando aviso 2. Faltam {aviso2} minutos.")
        send_rcon(msg2)
        state[key_warn2] = True
        save_json(STATE_PATH, state)
        return

    # Executa somente no minuto exato do horário.
    if minutes_until == 0 and state.get(key_restart) != True:
        log("Horário do restart atingido. Executando reinício seguro.")
        ok = run_safe_restart()
        state[key_restart] = ok
        save_json(STATE_PATH, state)
        return


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERRO GERAL: {e}")
        sys.exit(1)
