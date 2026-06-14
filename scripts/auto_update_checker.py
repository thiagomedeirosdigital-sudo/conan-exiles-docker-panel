#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path("/home/linux/conan-server")
ENV_PATH = BASE / ".env"
SETTINGS_PATH = BASE / "auto_update_settings.json"
STATE_PATH = BASE / "auto_update_state.json"
LOG_PATH = BASE / "auto_update_checker.log"
LOCK_PATH = BASE / "auto_update_checker.lock"

RCON_URL = "http://localhost:3000/api/rcon"
SAFE_RESTART_URL = "http://localhost:3000/api/safe-restart"


def log(msg: str):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def read_env():
    data = {}
    if not ENV_PATH.exists():
        return data

    for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def post_json(url: str, payload=None, timeout=60):
    raw = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=raw,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def send_rcon(message: str):
    try:
        status, body = post_json(RCON_URL, {"mensagem": message}, timeout=30)
        log(f"RCON enviado. HTTP={status}. Resposta={body[:300]}")
        return True
    except Exception as e:
        log(f"Falha ao enviar aviso RCON: {e}")
        return False


def run_safe_restart():
    try:
        status, body = post_json(SAFE_RESTART_URL, {}, timeout=1200)
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


def get_local_server_build(app_id: str):
    candidates = list((BASE / "server-files").rglob(f"appmanifest_{app_id}.acf"))

    for path in candidates:
        txt = path.read_text(encoding="utf-8", errors="ignore")
        m = re.search(r'"buildid"\s+"(\d+)"', txt)
        if m:
            return m.group(1), str(path)

    return "", ""


def check_server_update(app_id: str):
    local_build, manifest_path = get_local_server_build(app_id)

    if not local_build:
        return {
            "ok": False,
            "update": False,
            "reason": "appmanifest não encontrado; não foi possível checar build do servidor",
            "localBuild": "",
            "requiredVersion": "",
            "manifest": ""
        }

    url = (
        "https://api.steampowered.com/ISteamApps/UpToDateCheck/v1/"
        + "?"
        + urllib.parse.urlencode({"appid": app_id, "version": local_build})
    )

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))

        response = data.get("response", {})
        up_to_date = bool(response.get("up_to_date", True))
        required = str(response.get("required_version", local_build))

        return {
            "ok": True,
            "update": not up_to_date,
            "reason": "server_update" if not up_to_date else "server_ok",
            "localBuild": local_build,
            "requiredVersion": required,
            "manifest": manifest_path
        }
    except Exception as e:
        return {
            "ok": False,
            "update": False,
            "reason": f"falha Steam UpToDateCheck: {e}",
            "localBuild": local_build,
            "requiredVersion": "",
            "manifest": manifest_path
        }


def get_mod_ids(env):
    raw = env.get("MODS", "")
    return [m.strip() for m in raw.split(",") if m.strip().isdigit()]


def fetch_mod_details(mod_ids):
    if not mod_ids:
        return {}

    params = [("itemcount", str(len(mod_ids)))]
    for i, mod_id in enumerate(mod_ids):
        params.append((f"publishedfileids[{i}]", mod_id))

    raw = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(
        "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
        data=raw,
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))

    details = {}
    for item in data.get("response", {}).get("publishedfiledetails", []):
        mod_id = str(item.get("publishedfileid", ""))
        if not mod_id:
            continue
        details[mod_id] = {
            "title": item.get("title", ""),
            "time_updated": int(item.get("time_updated", 0) or 0),
            "result": item.get("result")
        }
    return details


def check_mod_updates(mod_ids, state):
    previous = state.get("lastModTimes", {})
    current = fetch_mod_details(mod_ids)

    changed = []
    for mod_id, info in current.items():
        old_time = int(previous.get(mod_id, 0) or 0)
        new_time = int(info.get("time_updated", 0) or 0)

        if old_time and new_time and new_time > old_time:
            changed.append({
                "modId": mod_id,
                "title": info.get("title", ""),
                "old": old_time,
                "new": new_time
            })

    return current, changed


def acquire_lock():
    if LOCK_PATH.exists():
        try:
            age = time.time() - LOCK_PATH.stat().st_mtime
            if age < 3600:
                log("Lock existe; outra verificação pode estar em andamento. Saindo.")
                return False
        except Exception:
            pass

    LOCK_PATH.write_text(str(os.getpid()), encoding="utf-8")
    return True


def release_lock():
    try:
        LOCK_PATH.unlink(missing_ok=True)
    except Exception:
        pass


def in_cooldown(state, cooldown_min):
    last_action = state.get("lastAutoUpdateAction", "")
    if not last_action:
        return False

    try:
        last = datetime.fromisoformat(last_action)
        return datetime.now() - last < timedelta(minutes=cooldown_min)
    except Exception:
        return False


def main():
    if not acquire_lock():
        return

    try:
        settings = load_json(SETTINGS_PATH, {})
        state = load_json(STATE_PATH, {})

        if not settings.get("checkerAtivo", True):
            log("Checker desativado. Saindo.")
            return

        env = read_env()
        app_id = str(settings.get("appIdServidor", "443030"))
        mod_ids = get_mod_ids(env)
        cooldown = int(settings.get("cooldownMinutos", 60) or 60)

        log("Iniciando verificação de updates Conan/mods.")

        server_status = check_server_update(app_id)
        log(f"Servidor: {server_status}")

        try:
            current_mods, changed_mods = check_mod_updates(mod_ids, state)
            log(f"Mods checados: {len(current_mods)}. Mods alterados: {len(changed_mods)}.")
        except Exception as e:
            current_mods = {}
            changed_mods = []
            log(f"Falha ao consultar mods no Steam Workshop: {e}")

        first_run = not state.get("initialized", False)

        state["lastCheck"] = datetime.now().isoformat(timespec="seconds")
        state["lastServerLocalBuild"] = server_status.get("localBuild", "")
        state["lastServerRequiredVersion"] = server_status.get("requiredVersion", "")
        state["lastServerCheckOk"] = server_status.get("ok", False)

        if current_mods:
            state["lastModTimes"] = {
                mod_id: info.get("time_updated", 0)
                for mod_id, info in current_mods.items()
            }
            state["lastModTitles"] = {
                mod_id: info.get("title", "")
                for mod_id, info in current_mods.items()
            }

        if first_run:
            state["initialized"] = True
            state["lastAction"] = "baseline_created"
            save_json(STATE_PATH, state)
            log("Primeira execução: base de comparação criada. Nenhum restart será feito agora.")
            return

        update_reasons = []

        if server_status.get("update", False):
            update_reasons.append(
                f"Servidor Conan build local {server_status.get('localBuild')} -> requerida {server_status.get('requiredVersion')}"
            )

        for mod in changed_mods:
            title = mod.get("title") or mod.get("modId")
            update_reasons.append(f"Mod atualizado: {title} ({mod.get('modId')})")

        if not update_reasons:
            state["lastAction"] = "no_update"
            save_json(STATE_PATH, state)
            log("Nenhuma atualização detectada.")
            return

        state["lastDetectedUpdate"] = datetime.now().isoformat(timespec="seconds")
        state["lastDetectedReasons"] = update_reasons
        save_json(STATE_PATH, state)

        log("Atualização detectada: " + " | ".join(update_reasons))

        if not settings.get("autoUpdateAtivo", False):
            log("autoUpdateAtivo=false. Apenas registrando atualização, sem reiniciar.")
            return

        if in_cooldown(state, cooldown):
            log(f"Cooldown ativo ({cooldown} minutos). Não reiniciando agora.")
            return

        aviso_min = int(settings.get("avisoMinutos", 2) or 2)
        mensagem = str(settings.get("mensagemAviso", "")).strip()
        if not mensagem:
            mensagem = f"[UPDATE] Atualização detectada. Servidor reinicia em {aviso_min} minutos."

        log(f"Enviando aviso aos jogadores. Aguardando {aviso_min} minutos.")
        send_rcon(mensagem)

        time.sleep(max(1, aviso_min) * 60)

        log("Executando reinício seguro para aplicar update.")
        ok = run_safe_restart()

        state = load_json(STATE_PATH, state)
        state["lastAutoUpdateAction"] = datetime.now().isoformat(timespec="seconds")
        state["lastAutoUpdateOk"] = ok
        state["lastAction"] = "auto_update_restart_ok" if ok else "auto_update_restart_failed"
        save_json(STATE_PATH, state)

    finally:
        release_lock()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERRO GERAL: {e}")
        release_lock()
        sys.exit(1)
