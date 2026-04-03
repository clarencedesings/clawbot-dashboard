import bcrypt
import hashlib
import logging
import re
import subprocess
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, Query, Request
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import json
import uuid
import os
import time
import paramiko
import secrets

load_dotenv()

logger = logging.getLogger(__name__)

def safe_path(base_dir: str, filename: str) -> str:
    """Prevent path traversal by ensuring filename stays within base_dir."""
    base = os.path.realpath(base_dir)
    full = os.path.realpath(os.path.join(base, os.path.basename(filename)))
    if not full.startswith(base):
        raise ValueError(f"Path traversal detected: {filename}")
    return full


def _safe_remote_filename(filename: str) -> str:
    """Sanitize a remote filename to prevent path traversal over SSH/SFTP."""
    name = os.path.basename(filename)
    if not name or name.startswith("."):
        raise ValueError(f"Invalid filename: {filename}")
    return name


app = FastAPI(title="Clawbot Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth
DASHBOARD_PASSWORD_HASH = b"$2b$12$weHzQA6/tGgQtdoTrkVVbuNoqEaSofB38ayHJLLxjtfWOxCtyshjm"
VALID_TOKENS = set()

@app.post("/api/auth/login")
def auth_login(body: dict):
    password = body.get("password", "")
    if bcrypt.checkpw(password.encode(), DASHBOARD_PASSWORD_HASH):
        token = secrets.token_hex(32)
        VALID_TOKENS.add(token)
        return {"success": True, "token": token}
    return {"success": False}

@app.post("/api/auth/logout")
def auth_logout(body: dict):
    token = body.get("token", "")
    VALID_TOKENS.discard(token)
    return {"success": True}

@app.get("/api/auth/verify")
def auth_verify(request: Request):
    token = request.headers.get("x-auth-token", "")
    return {"valid": token in VALID_TOKENS}

# SSH config for Clawbot
CLAWBOT_HOST = "192.168.0.130"
CLAWBOT_PORT = 2222
CLAWBOT_USER = "clarence"
CLAWBOT_PASSWORD = os.getenv("CLAWBOT_PASSWORD", "")
OPENCLAW_CONFIG_PATH = "/home/clarence/.openclaw/openclaw.json"

# Persistent SSH connection
_ssh_persistent = {"client": None, "last_used": 0}
SSH_KEEPALIVE_TIMEOUT = 60  # seconds


def _get_persistent_ssh():
    """Get or create a persistent SSH connection."""
    now = time.time()
    client = _ssh_persistent["client"]
    if client:
        try:
            transport = client.get_transport()
            if transport and transport.is_active():
                _ssh_persistent["last_used"] = now
                return client
        except Exception:
            pass
    # Create new connection
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(CLAWBOT_HOST, port=CLAWBOT_PORT, username=CLAWBOT_USER, password=CLAWBOT_PASSWORD)
    client.get_transport().set_keepalive(30)
    _ssh_persistent["client"] = client
    _ssh_persistent["last_used"] = now
    return client


# Cache for SSH reads
_config_cache = {"data": None, "timestamp": 0}
_status_cache = {
    "gateway": False,
    "ollama": False,
    "gateway_uptime": "—",
    "ollama_uptime": "—",
    "last_active": "—",
    "timestamp": 0,
}
CACHE_TTL = 30  # seconds
_logs_cache = {"data": [], "timestamp": 0}
LOGS_CACHE_TTL = 10  # seconds
_alerts_cache = {"data": [], "timestamp": 0}
ALERTS_CACHE_TTL = 30  # seconds
_tokens_cache = {"data": None, "timestamp": 0}
TOKENS_CACHE_TTL = 30  # seconds
_memory_cache = {"data": None, "timestamp": 0}
MEMORY_CACHE_TTL = 60  # seconds
_store_summary_cache = {"data": None, "timestamp": 0}
_store_orders_cache = {"data": None, "timestamp": 0}
STORE_CACHE_TTL = 30  # seconds
MEMORY_FILES = [
    "/home/clarence/.openclaw/agents/main/USER.md",
    "/home/clarence/.openclaw/agents/main/agent/IDENTITY.md",
    "/home/clarence/.openclaw/agents/business/agent/IDENTITY.md",
    "/home/clarence/.openclaw/agents/research/agent/IDENTITY.md",
    "/home/clarence/.openclaw/agents/coder/agent/IDENTITY.md",
    "/home/clarence/.openclaw/workspace-coder/USER.md",
    "/home/clarence/.openclaw/workspace-coder/IDENTITY.md",
    "/home/clarence/.openclaw/workspace-coder/SOUL.md",
]
SESSIONS_DIR = "/home/clarence/.openclaw/agents/main/sessions"
DISMISSED_ALERTS_FILE = Path(__file__).parent / "dismissed_alerts.json"
TASKS_HISTORY_FILE = Path(__file__).parent / "tasks_history.json"
AGENT_QUEUE_DIR = "/home/clarence/agent-queue"
AGENT_QUEUE_PENDING = f"{AGENT_QUEUE_DIR}/pending"
AGENT_QUEUE_APPROVED = f"{AGENT_QUEUE_DIR}/approved"
AGENT_QUEUE_DENIED = f"{AGENT_QUEUE_DIR}/denied"

MOCK_BOTS = [
    {
        "id": "jarvis",
        "name": "Jarvis",
        "role": "main",
        "status": "offline",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
    {
        "id": "business",
        "name": "Business",
        "role": "business",
        "status": "offline",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
    {
        "id": "research",
        "name": "Research",
        "role": "research",
        "status": "offline",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
    {
        "id": "coder",
        "name": "Coder",
        "role": "coder",
        "status": "offline",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
]


def _ssh_connect():
    """Create and return a connected paramiko SSH client."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=CLAWBOT_HOST,
        port=CLAWBOT_PORT,
        username=CLAWBOT_USER,
        password=CLAWBOT_PASSWORD,
        timeout=5,
    )
    return client


def _openclaw_log_path() -> str:
    """Get today's openclaw log file path."""
    log_dir = os.getenv("OPENCLAW_LOG", "/tmp/openclaw/")
    if log_dir.endswith("/"):
        today = datetime.now().strftime("%Y-%m-%d")
        return f"{log_dir}openclaw-{today}.log"
    return log_dir


def _parse_systemd_timestamp(raw: str) -> datetime | None:
    """Parse systemd ActiveEnterTimestamp like 'Thu 2026-03-11 02:14:33 UTC'."""
    # Format: ActiveEnterTimestamp=Thu 2026-03-11 02:14:33 UTC
    val = raw.split("=", 1)[-1].strip()
    if not val or val == "n/a":
        return None
    try:
        # Strip day-of-week prefix (e.g. "Thu ")
        parts = val.split(" ", 1)
        if len(parts) == 2 and len(parts[0]) <= 3:
            val = parts[1]
        # Parse "2026-03-11 02:14:33 UTC"
        return datetime.strptime(val, "%Y-%m-%d %H:%M:%S %Z").replace(tzinfo=timezone.utc)
    except (ValueError, IndexError):
        return None


def _format_uptime(start: datetime | None) -> str:
    """Format a start timestamp as human-readable uptime."""
    if start is None:
        return "—"
    delta = datetime.now(timezone.utc) - start
    total_seconds = int(delta.total_seconds())
    if total_seconds < 0:
        return "—"
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def ssh_read_openclaw_config() -> dict | None:
    """Read openclaw.json from Clawbot via SSH, cached for 30 seconds."""
    now = time.time()
    if _config_cache["data"] is not None and (now - _config_cache["timestamp"]) < CACHE_TTL:
        return _config_cache["data"]

    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(f"cat {OPENCLAW_CONFIG_PATH}")
        raw = stdout.read().decode("utf-8")
        client.close()

        config = json.loads(raw)
        _config_cache["data"] = config
        _config_cache["timestamp"] = now
        return config
    except Exception:
        return _config_cache["data"]  # return stale cache if available


def ssh_check_services() -> dict:
    """Check gateway/ollama status, uptimes, and last log activity via SSH."""
    now = time.time()
    if (now - _status_cache["timestamp"]) < CACHE_TTL:
        return _status_cache

    try:
        client = _ssh_connect()

        # Check if gateway port 18789 is listening
        _, stdout_gw, _ = client.exec_command("ss -tlnp | grep 18789")
        gateway_online = len(stdout_gw.read().decode("utf-8").strip()) > 0

        # Check if ollama is running
        _, stdout_ol, _ = client.exec_command("pgrep ollama")
        ollama_online = len(stdout_ol.read().decode("utf-8").strip()) > 0

        # Gateway service uptime
        _, stdout_gw_ts, _ = client.exec_command(
            "systemctl --user show openclaw-gateway.service --property=ActiveEnterTimestamp"
        )
        gw_ts = _parse_systemd_timestamp(stdout_gw_ts.read().decode("utf-8"))
        gateway_uptime = _format_uptime(gw_ts) if gateway_online else "—"

        # Ollama service uptime
        _, stdout_ol_ts, _ = client.exec_command(
            "systemctl --user show ollama.service --property=ActiveEnterTimestamp"
        )
        ol_ts = _parse_systemd_timestamp(stdout_ol_ts.read().decode("utf-8"))
        ollama_uptime = _format_uptime(ol_ts) if ollama_online else "—"

        # Last active: read last line of today's openclaw log
        _, stdout_log, _ = client.exec_command(
            f"tail -1 {_openclaw_log_path()} 2>/dev/null"
        )
        last_log_line = stdout_log.read().decode("utf-8").strip()
        last_active = "—"
        if last_log_line:
            # Try to extract timestamp from beginning of log line
            try:
                # Common log formats: "2026-03-12 14:22:01 ..." or "[2026-03-12T14:22:01] ..."
                ts_str = last_log_line[:19].strip("[]")
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        log_dt = datetime.strptime(ts_str, fmt).replace(tzinfo=timezone.utc)
                        delta = datetime.now(timezone.utc) - log_dt
                        total_min = int(delta.total_seconds()) // 60
                        if total_min < 1:
                            last_active = "just now"
                        elif total_min < 60:
                            last_active = f"{total_min}m ago"
                        elif total_min < 1440:
                            last_active = f"{total_min // 60}h ago"
                        else:
                            last_active = f"{total_min // 1440}d ago"
                        break
                    except ValueError:
                        continue
            except Exception:
                pass

        client.close()

        _status_cache["gateway"] = gateway_online
        _status_cache["ollama"] = ollama_online
        _status_cache["gateway_uptime"] = gateway_uptime
        _status_cache["ollama_uptime"] = ollama_uptime
        _status_cache["last_active"] = last_active
        _status_cache["timestamp"] = now
        return _status_cache
    except Exception:
        return _status_cache  # return stale cache


def _resolve_model(model_val, fallback: str) -> str:
    """Extract model string from a value that may be a dict with 'primary' key."""
    if isinstance(model_val, dict):
        return model_val.get("primary", fallback)
    if isinstance(model_val, str):
        return model_val
    return fallback


def bots_from_config(config: dict) -> list[dict]:
    """Parse openclaw.json into bot list."""
    services = ssh_check_services()
    gateway_online = services["gateway"]
    ollama_online = services["ollama"]

    agents_config = config.get("agents", {})

    # Default model from agents.defaults.model.primary
    default_model = _resolve_model(
        agents_config.get("defaults", {}).get("model", {}), "unknown"
    )

    bots = []

    # All agents from agents.list
    agent_list = agents_config.get("list", [])
    for agent in agent_list:
        agent_id = agent.get("id", agent.get("name", "unknown")).lower().replace(" ", "-")
        is_main = agent_id == "main"

        # Name: "Jarvis" for main, otherwise identity.name or capitalized id
        if is_main:
            name = "Jarvis"
        else:
            identity = agent.get("identity", {})
            name = identity.get("name", agent_id.capitalize())

        model = _resolve_model(agent.get("model", default_model), default_model)

        # Main agent status tied to gateway, subagents tied to ollama
        if is_main:
            status = "online" if gateway_online else "offline"
            uptime = services["gateway_uptime"]
            last_active = services["last_active"]
        else:
            status = "online" if ollama_online else "offline"
            uptime = services["ollama_uptime"]
            last_active = "—"

        bots.append({
            "id": agent_id,
            "name": name,
            "role": agent_id,
            "status": status,
            "model": model,
            "uptime": uptime,
            "requests_today": 0,
            "last_active": last_active,
        })

    return bots


@app.get("/api/health")
async def health():
    return {"status": "ok"}


_notif_cache: dict = {"data": None, "timestamp": 0}

@app.get("/api/notifications")
async def notifications():
    now_t = time.time()
    if _notif_cache["data"] is not None and (now_t - _notif_cache["timestamp"]) < 15:
        return _notif_cache["data"]
    try:
        client = _ssh_connect()
        _, stdout1, _ = client.exec_command(
            "ls /home/clarence/agent-queue/pending/ 2>/dev/null | wc -l"
        )
        pending_tasks = int(stdout1.read().decode().strip() or "0")
        _, stdout2, _ = client.exec_command(
            "ls /home/clarence/paige/staged/ 2>/dev/null | wc -l"
        )
        pending_posts = int(stdout2.read().decode().strip() or "0")
        client.close()
        result = {
            "pending_tasks": pending_tasks,
            "pending_posts": pending_posts,
            "total": pending_tasks + pending_posts,
        }
    except Exception:
        result = {"pending_tasks": 0, "pending_posts": 0, "total": 0}
    _notif_cache["data"] = result
    _notif_cache["timestamp"] = now_t
    return result


def _format_age(ms):
    """Convert milliseconds age to human readable string."""
    if ms is None:
        return "Never"
    seconds = ms / 1000
    if seconds < 60:
        return "Just now"
    minutes = seconds / 60
    if minutes < 60:
        return f"{int(minutes)}m ago"
    hours = minutes / 60
    if hours < 24:
        return f"{int(hours)}h ago"
    days = hours / 24
    return f"{int(days)}d ago"


def _get_openclaw_status() -> dict | None:
    """Fetch openclaw status --json from CLAWBOT."""
    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(
            "/home/clarence/.npm-global/bin/openclaw status --json 2>/dev/null",
            timeout=15,
        )
        raw = stdout.read().decode("utf-8", errors="replace").strip()
        client.close()
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


@app.get("/api/bots")
async def get_bots():
    status_data = _get_openclaw_status()
    if not status_data:
        # Fallback to config-based approach
        config = ssh_read_openclaw_config()
        if config:
            bots = bots_from_config(config)
        else:
            bots = MOCK_BOTS
        return {"bots": bots}

    # Build lookup maps from status data
    heartbeat_map = {}
    for hb in status_data.get("heartbeat", {}).get("agents", []):
        heartbeat_map[hb["agentId"]] = hb

    agents_map = {}
    for ag in status_data.get("agents", {}).get("agents", []):
        agents_map[ag["id"]] = ag

    sessions_map = {}
    for sa in status_data.get("sessions", {}).get("byAgent", []):
        sessions_map[sa["agentId"]] = sa

    agent_names = {"main": "Jarvis", "business": "Business", "research": "Research", "coder": "Coder"}

    bots = []
    for agent_id in ("main", "business", "research", "coder"):
        hb = heartbeat_map.get(agent_id, {})
        ag = agents_map.get(agent_id, {})
        sa = sessions_map.get(agent_id, {})
        recent = sa.get("recent", [])

        # Status from heartbeat
        is_online = hb.get("enabled", False)

        # Model from most recent session
        model = recent[0].get("model", "unknown") if recent else "unknown"

        # Last active from agent data
        last_active = _format_age(ag.get("lastActiveAgeMs"))

        # Sessions count
        sessions = ag.get("sessionsCount", 0)

        # Context used from most recent session
        context_used = recent[0].get("percentUsed") if recent else None

        bots.append({
            "id": agent_id,
            "name": agent_names.get(agent_id, agent_id.capitalize()),
            "role": agent_id,
            "status": "online" if is_online else "offline",
            "model": model,
            "last_active": last_active,
            "sessions": sessions,
            "context_used": context_used,
        })

    return {"bots": bots}


@app.get("/api/bots/{bot_id}")
async def get_bot(bot_id: str):
    config = ssh_read_openclaw_config()
    bots = bots_from_config(config) if config else MOCK_BOTS
    for bot in bots:
        if bot["id"] == bot_id:
            return bot
    return {"error": "Bot not found"}, 404


@app.get("/api/gateway/status")
async def gateway_status():
    gateway_url = os.getenv("OPENCLAW_GATEWAY", "ws://127.0.0.1:18789")
    services = ssh_check_services()
    return {
        "online": services["gateway"],
        "port": 18789,
        "gateway": gateway_url,
    }


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    config = ssh_read_openclaw_config()
    if config:
        bots = bots_from_config(config)
        agents_config = config.get("agents", {})
        model = _resolve_model(
            agents_config.get("defaults", {}).get("model", {}), "unknown"
        )
    else:
        bots = MOCK_BOTS
        model = "unknown"

    online_count = sum(1 for b in bots if b["status"] == "online")
    services = ssh_check_services()

    # Extra stats via single SSH connection
    paige_status = False
    pending_posts = 0
    pending_tasks = 0
    disk_used = "—"
    disk_total = "—"
    sessions_today = 0
    try:
        client = _ssh_connect()
        # Paige webhook service
        _, stdout_p, _ = client.exec_command(
            "systemctl is-active paige-webhook.service 2>/dev/null"
        )
        paige_status = stdout_p.read().decode().strip() == "active"

        # Pending counts
        _, stdout_pp, _ = client.exec_command(
            "ls /home/clarence/paige/staged/ 2>/dev/null | wc -l"
        )
        pending_posts = int(stdout_pp.read().decode().strip() or "0")

        _, stdout_pt, _ = client.exec_command(
            "ls /home/clarence/agent-queue/pending/ 2>/dev/null | wc -l"
        )
        pending_tasks = int(stdout_pt.read().decode().strip() or "0")

        # Disk usage
        _, stdout_df, _ = client.exec_command("df -h / | tail -1")
        df_line = stdout_df.read().decode().strip().split()
        if len(df_line) >= 4:
            disk_total = df_line[1]
            disk_used = df_line[2]

        # Sessions today from openclaw status
        _, stdout_oc, _ = client.exec_command(
            "/home/clarence/.npm-global/bin/openclaw status --json 2>/dev/null",
            timeout=15,
        )
        oc_raw = stdout_oc.read().decode("utf-8", errors="replace").strip()
        if oc_raw:
            oc_data = json.loads(oc_raw)
            for ag in oc_data.get("agents", []):
                sessions_today += ag.get("sessionsCount", 0)

        client.close()
    except Exception:
        pass

    return {
        "total_bots": len(bots),
        "online_bots": online_count,
        "gateway_online": services["gateway"],
        "model": model,
        "paige_status": paige_status,
        "pending_posts": pending_posts,
        "pending_tasks": pending_tasks,
        "disk_used": disk_used,
        "disk_total": disk_total,
        "sessions_today": sessions_today,
    }


def _parse_log_timestamp(raw_ts: str) -> str:
    """Parse a timestamp string and return HH:MM:SS format."""
    if not raw_ts:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw_ts[:26].rstrip("Z"), fmt.rstrip("Z"))
            return dt.strftime("%H:%M:%S")
        except ValueError:
            continue
    # Last resort: look for HH:MM:SS pattern in the string
    m = re.search(r"(\d{2}:\d{2}:\d{2})", raw_ts)
    return m.group(1) if m else raw_ts[:8]


_LEVEL_ID_MAP = {1: "FATAL", 2: "ERROR", 3: "WARN", 4: "INFO", 5: "DEBUG", 6: "TRACE"}
_VALID_LEVELS = {"FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"}

# Source detection rules: (keywords, source_label)
_SOURCE_RULES = [
    (("telegram",), "telegram"),
    (("embedded run", "run registered", "run cleared", "lane"), "agent"),
    (("gateway", "listening on ws", "canvas"), "gateway"),
    (("heartbeat", "started (interval"), "heartbeat"),
    (("config", "hot reload"), "config"),
    (("sigterm", "shutting down"), "system"),
]

# Patterns that indicate a real error
_ERROR_PATTERN = re.compile(
    r"isError=true|rate_limit_error|authentication_error|credit balance is too low|HTTP 4\d\d",
    re.IGNORECASE,
)


def _infer_source(message: str) -> str:
    """Infer source from message content."""
    msg_lower = message.lower()
    for keywords, source in _SOURCE_RULES:
        for kw in keywords:
            if kw in msg_lower:
                return source
    return "system"


def _should_be_error(message: str) -> bool:
    """Check if a message indicates a real error condition."""
    if "iserror=false" in message.lower():
        return False
    if _ERROR_PATTERN.search(message):
        return True
    if "failed" in message.lower():
        return True
    return False


def _parse_log_line(line: str) -> dict:
    """Parse a single log line — expects JSON, falls back to plain text."""
    try:
        obj = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        source = _infer_source(line)
        level = "ERROR" if _should_be_error(line) else "INFO"
        return {
            "timestamp": "",
            "level": level,
            "source": source,
            "message": line,
        }

    # Timestamp from "time" or "date" field
    raw_ts = obj.get("time", obj.get("date", ""))
    timestamp = _parse_log_timestamp(str(raw_ts))

    # Level: prefer logLevelId numeric mapping, fall back to logLevelName
    level_id = obj.get("logLevelId")
    level_name = str(obj.get("logLevelName", "")).upper()
    if level_name == "WARNING":
        level_name = "WARN"

    if isinstance(level_id, int) and level_id in _LEVEL_ID_MAP:
        level = _LEVEL_ID_MAP[level_id]
    elif level_name in _VALID_LEVELS:
        level = level_name
    else:
        level = "INFO"

    # Message from "1" field (human-readable message)
    message = str(obj.get("1", obj.get("message", obj.get("msg", ""))))

    # Infer source from message content
    source = _infer_source(message)

    # Promote to ERROR if message indicates a real error
    if level not in ("ERROR", "FATAL") and _should_be_error(message):
        level = "ERROR"

    return {
        "timestamp": timestamp,
        "level": level,
        "source": source,
        "message": message,
    }


def ssh_read_logs() -> list[dict]:
    """Read last 200 lines from the most recent openclaw log via SSH, cached 10s."""
    now = time.time()
    if _logs_cache["data"] and (now - _logs_cache["timestamp"]) < LOGS_CACHE_TTL:
        return _logs_cache["data"]

    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(
            f"tail -200 {_openclaw_log_path()} 2>/dev/null"
        )
        raw = stdout.read().decode("utf-8", errors="replace")
        client.close()

        entries = []
        for line in raw.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            entries.append(_parse_log_line(line))

        # Newest first
        entries.reverse()
        _logs_cache["data"] = entries
        _logs_cache["timestamp"] = now
        return entries
    except Exception:
        return _logs_cache["data"]


@app.get("/api/logs")
async def get_logs(
    level: str | None = Query(None),
    source: str | None = Query(None),
):
    entries = ssh_read_logs()
    if level:
        level_upper = level.upper()
        entries = [e for e in entries if e["level"] == level_upper]
    else:
        # Filter out DEBUG and TRACE by default
        entries = [e for e in entries if e["level"] not in ("DEBUG", "TRACE")]
    if source:
        source_lower = source.lower()
        entries = [e for e in entries if e["source"] == source_lower]
    return {"logs": entries}


# Alert detection rules: (keywords, alert_type, severity)
_ALERT_RULES = [
    (("credit balance is too low", "billing error"), "BILLING", "critical"),
    (("authentication_error", "invalid x-api-key", "401"), "AUTH", "critical"),
    (("rate_limit_error", "429", "rate limit"), "RATE LIMIT", "warning"),
    (("context overflow", "prompt too large", "exceeds context limit"), "CONTEXT OVERFLOW", "warning"),
    (("iserror=true",), "BOT ERROR", "error"),
    (("sigterm", "shutting down"), "SERVICE RESTART", "info"),
    (("update available",), "UPDATE AVAILABLE", "info"),
]


def _load_dismissed() -> set[str]:
    """Load dismissed alert IDs from disk."""
    if DISMISSED_ALERTS_FILE.exists():
        try:
            return set(json.loads(DISMISSED_ALERTS_FILE.read_text()))
        except (json.JSONDecodeError, OSError):
            pass
    return set()


def _save_dismissed(dismissed: set[str]):
    """Save dismissed alert IDs to disk."""
    DISMISSED_ALERTS_FILE.write_text(json.dumps(list(dismissed)))


def _classify_alert(message: str) -> tuple[str, str] | None:
    """Check if a message is alert-worthy. Returns (type, severity) or None."""
    msg_lower = message.lower()
    # Skip isError=false
    if "iserror=false" in msg_lower:
        return None
    for keywords, alert_type, severity in _ALERT_RULES:
        for kw in keywords:
            if kw in msg_lower:
                return alert_type, severity
    return None


def _parse_log_timestamp_full(raw_ts: str) -> str:
    """Parse a timestamp and return ISO-style string for alert display."""
    if not raw_ts:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(raw_ts[:26].rstrip("Z"), fmt.rstrip("Z"))
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return raw_ts[:19]


def _parse_log_timestamp_dt(raw_ts: str) -> datetime | None:
    """Parse a timestamp into a datetime for dedup comparison."""
    if not raw_ts:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw_ts[:26].rstrip("Z"), fmt.rstrip("Z"))
        except ValueError:
            continue
    return None


def ssh_read_alerts() -> list[dict]:
    """Read all log lines, extract alert-worthy events, deduplicate by type within 1 hour."""
    now = time.time()
    if _alerts_cache["data"] and (now - _alerts_cache["timestamp"]) < ALERTS_CACHE_TTL:
        return _alerts_cache["data"]

    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(
            f"cat {_openclaw_log_path()} 2>/dev/null"
        )
        raw = stdout.read().decode("utf-8", errors="replace")
        client.close()
    except Exception:
        return _alerts_cache["data"]

    dismissed = _load_dismissed()

    # Collect raw alerts
    raw_alerts = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            message = str(obj.get("1", obj.get("message", obj.get("msg", ""))))
            raw_ts = str(obj.get("time", obj.get("date", "")))
        except (json.JSONDecodeError, ValueError):
            message = line
            raw_ts = ""

        result = _classify_alert(message)
        if result is None:
            continue

        alert_type, severity = result
        timestamp_str = _parse_log_timestamp_full(raw_ts)
        timestamp_dt = _parse_log_timestamp_dt(raw_ts)
        raw_alerts.append({
            "type": alert_type,
            "severity": severity,
            "message": message,
            "timestamp": timestamp_str,
            "timestamp_dt": timestamp_dt,
        })

    # Deduplicate: same type within 1 hour = one alert, count occurrences
    deduped = {}  # key: (type, hour_bucket) -> alert
    for alert in raw_alerts:
        dt = alert["timestamp_dt"]
        if dt:
            bucket = f"{alert['type']}_{dt.strftime('%Y%m%d%H')}"
        else:
            bucket = f"{alert['type']}_unknown"

        if bucket in deduped:
            deduped[bucket]["count"] += 1
            # Keep the most recent timestamp
            if alert["timestamp"] > deduped[bucket]["timestamp"]:
                deduped[bucket]["timestamp"] = alert["timestamp"]
                deduped[bucket]["message"] = alert["message"]
        else:
            alert_id = hashlib.md5(bucket.encode()).hexdigest()[:12]
            deduped[bucket] = {
                "id": alert_id,
                "type": alert["type"],
                "severity": alert["severity"],
                "message": alert["message"],
                "timestamp": alert["timestamp"],
                "count": 1,
            }

    # Filter dismissed, sort newest first
    alerts = [a for a in deduped.values() if a["id"] not in dismissed]
    alerts.sort(key=lambda a: a["timestamp"], reverse=True)

    _alerts_cache["data"] = alerts
    _alerts_cache["timestamp"] = now
    return alerts


@app.get("/api/alerts")
async def get_alerts():
    alerts = ssh_read_alerts()
    return {"alerts": alerts}


@app.post("/api/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str):
    dismissed = _load_dismissed()
    dismissed.add(alert_id)
    _save_dismissed(dismissed)
    # Clear cache so next fetch reflects dismissal
    _alerts_cache["timestamp"] = 0
    return {"status": "dismissed", "id": alert_id}


_DURATION_PATTERN = re.compile(r"durationMs=(\d+)")
_MODEL_PATTERN = re.compile(r"model=([\w\-\.]+)")
_RUNID_PATTERN = re.compile(r"runId=([\w\-]+)")


def ssh_read_token_usage() -> dict:
    """Read log lines and extract token/usage data, cached 30s."""
    now_time = time.time()
    if _tokens_cache["data"] is not None and (now_time - _tokens_cache["timestamp"]) < TOKENS_CACHE_TTL:
        return _tokens_cache["data"]

    try:
        client = _ssh_connect()
        # Read ALL log files for token usage history
        _, stdout, _ = client.exec_command(
            "cat /tmp/openclaw/openclaw-*.log 2>/dev/null"
        )
        raw = stdout.read().decode("utf-8", errors="replace")
        client.close()
    except Exception:
        return _tokens_cache["data"] or _empty_token_data()

    # Graceful fallback for empty/missing logs (e.g. after reboot)
    if not raw or not raw.strip():
        result = _empty_token_data()
        _tokens_cache["data"] = result
        _tokens_cache["timestamp"] = now_time
        return result

    # First pass: parse all lines into structured entries
    parsed_lines = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            message = str(obj.get("1", obj.get("message", obj.get("msg", ""))))
            raw_ts = str(obj.get("time", obj.get("date", "")))
        except (json.JSONDecodeError, ValueError):
            message = line
            raw_ts = ""

        msg_lower = message.lower()
        is_run_start = "embedded run start" in msg_lower or ("embedded run" in msg_lower and "registered" in msg_lower)
        is_run_done = "embedded run done" in msg_lower

        if not is_run_start and not is_run_done and "provider=anthropic" not in msg_lower:
            continue

        parsed_lines.append({
            "message": message,
            "msg_lower": msg_lower,
            "raw_ts": raw_ts,
            "is_run_start": is_run_start,
            "is_run_done": is_run_done,
        })

    # Second pass: build runId → model mapping from start messages
    run_models = {}  # runId -> model
    run_start_ts = {}  # runId -> raw_ts
    for entry in parsed_lines:
        if entry["is_run_start"]:
            rid_match = _RUNID_PATTERN.search(entry["message"])
            model_match = _MODEL_PATTERN.search(entry["message"])
            if rid_match:
                run_id = rid_match.group(1)
                run_models[run_id] = model_match.group(1) if model_match else "unknown"
                run_start_ts[run_id] = entry["raw_ts"]

    # Third pass: collect stats and build activity from done messages
    requests_total = 0
    errors_total = 0
    success_durations = []
    hourly = {}
    recent_runs = []

    for entry in parsed_lines:
        message = entry["message"]
        msg_lower = entry["msg_lower"]
        raw_ts = entry["raw_ts"]
        dt = _parse_log_timestamp_dt(raw_ts)
        is_error = "iserror=true" in msg_lower and "iserror=false" not in msg_lower

        if entry["is_run_start"] or "provider=anthropic" in msg_lower:
            requests_total += 1
            if dt:
                hour_key = dt.strftime("%Y-%m-%d %H:00")
                hourly[hour_key] = hourly.get(hour_key, 0) + 1

        if is_error:
            errors_total += 1

        # Build activity entries from done messages, matched with start data
        if entry["is_run_done"]:
            dur_match = _DURATION_PATTERN.search(message)
            duration_ms = int(dur_match.group(1)) if dur_match else None

            if duration_ms is not None and not is_error:
                success_durations.append(duration_ms)

            rid_match = _RUNID_PATTERN.search(message)
            run_id = rid_match.group(1) if rid_match else None
            model = run_models.get(run_id, "unknown") if run_id else "unknown"

            timestamp_display = _parse_log_timestamp(raw_ts) if raw_ts else "—"
            recent_runs.append({
                "time": timestamp_display,
                "model": model,
                "duration_ms": duration_ms,
                "is_error": is_error,
                "raw_ts": raw_ts,
            })

    # Build hourly breakdown from all hours with activity, sorted chronologically
    hourly_breakdown = []
    for key in sorted(hourly.keys()):
        # key is "YYYY-MM-DD HH:00", display as "MM/DD HH:00"
        try:
            dt = datetime.strptime(key, "%Y-%m-%d %H:00")
            label = dt.strftime("%m/%d %H:%M")
        except ValueError:
            label = key
        hourly_breakdown.append({
            "hour": label,
            "requests": hourly[key],
        })

    avg_response_ms = round(sum(success_durations) / len(success_durations)) if success_durations else 0

    # Per-model cost estimation
    estimated_cost = 0.0
    for r in recent_runs:
        model = r.get("model", "unknown") if isinstance(r, dict) else "unknown"
        model_lower = model.lower()
        if "llama" in model_lower or "ollama" in model_lower:
            pass  # free, local model
        elif "sonnet" in model_lower:
            # ~$0.003/1k input + $0.015/1k output, rough estimate $0.01 per request
            estimated_cost += 0.01
        else:
            estimated_cost += 0.003  # unknown model flat estimate
    estimated_cost = round(estimated_cost, 3)

    # Recent runs: newest first, last 20
    recent_runs.sort(key=lambda r: r["raw_ts"], reverse=True)
    recent_activity = [
        {
            "time": r["time"],
            "model": r["model"],
            "duration_ms": r["duration_ms"],
            "status": "error" if r["is_error"] else "success",
        }
        for r in recent_runs[:20]
    ]

    result = {
        "requests_total": requests_total,
        "avg_response_ms": avg_response_ms,
        "errors_total": errors_total,
        "estimated_cost": estimated_cost,
        "balance_remaining": "N/A",
        "hourly_breakdown": hourly_breakdown,
        "recent_activity": recent_activity,
    }

    _tokens_cache["data"] = result
    _tokens_cache["timestamp"] = now_time
    return result


def _empty_token_data() -> dict:
    return {
        "requests_total": 0,
        "avg_response_ms": 0,
        "errors_total": 0,
        "estimated_cost": 0,
        "balance_remaining": "N/A",
        "hourly_breakdown": [],
        "recent_activity": [],
    }


@app.get("/api/tokens")
async def get_tokens():
    return ssh_read_token_usage()


def ssh_read_memory() -> dict:
    """Read specific memory files from CLAWBOT via SSH, cached 60s."""
    now = time.time()
    if _memory_cache["data"] is not None and (now - _memory_cache["timestamp"]) < MEMORY_CACHE_TTL:
        return _memory_cache["data"]

    try:
        client = _ssh_connect()

        # Count sessions
        _, stdout_sess, _ = client.exec_command(
            f"ls -1 {SESSIONS_DIR}/ 2>/dev/null | wc -l"
        )
        session_count = int(stdout_sess.read().decode("utf-8").strip() or "0")

        entries = []
        total_size = 0

        for filepath in MEMORY_FILES:
            # Get file stat and content in one go
            _, stdout_stat, _ = client.exec_command(
                f"stat --format='%s %Y' '{filepath}' 2>/dev/null"
            )
            stat_output = stdout_stat.read().decode("utf-8").strip()
            if not stat_output:
                continue  # file doesn't exist

            try:
                size_str, mtime_str = stat_output.split()
                size = int(size_str)
                mtime = datetime.fromtimestamp(int(mtime_str), tz=timezone.utc)
                last_modified = mtime.strftime("%Y-%m-%d %H:%M")
            except (ValueError, IndexError):
                continue

            _, stdout_cat, _ = client.exec_command(f"cat '{filepath}'")
            content = stdout_cat.read().decode("utf-8", errors="replace")

            # Use last two path segments as filename, e.g. "main/USER.md"
            parts = filepath.rstrip("/").split("/")
            filename = "/".join(parts[-2:]) if len(parts) >= 2 else parts[-1]

            total_size += size
            entries.append({
                "filename": filename,
                "content": content,
                "size": size,
                "last_modified": last_modified,
            })

        client.close()

        entries.sort(key=lambda e: e["last_modified"], reverse=True)

        result = {
            "entries": entries,
            "total_files": len(entries),
            "total_size": total_size,
            "session_count": session_count,
            "last_updated": entries[0]["last_modified"] if entries else "—",
        }

        _memory_cache["data"] = result
        _memory_cache["timestamp"] = now
        return result
    except Exception:
        return _memory_cache["data"] or {
            "entries": [],
            "total_files": 0,
            "total_size": 0,
            "session_count": 0,
            "last_updated": "—",
        }


@app.get("/api/memory")
async def get_memory():
    return ssh_read_memory()


@app.delete("/api/memory/{filename:path}")
async def delete_memory(filename: str):
    # Only allow deleting files that are in our known list
    if ".." in filename:
        return {"error": "Invalid filename"}, 400

    # Find matching file from MEMORY_FILES
    matched = None
    for filepath in MEMORY_FILES:
        parts = filepath.rstrip("/").split("/")
        short_name = "/".join(parts[-2:])
        if short_name == filename:
            matched = filepath
            break

    if not matched:
        return {"error": "File not in allowed list"}, 400

    try:
        client = _ssh_connect()
        _, stdout, stderr = client.exec_command(f"rm -f '{matched}'")
        stdout.read()
        err = stderr.read().decode("utf-8").strip()
        client.close()

        _memory_cache["timestamp"] = 0

        if err:
            return {"error": err}
        return {"status": "deleted", "filename": filename}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


def _ssh_mongosh(eval_str: str) -> str:
    """Run a mongosh command on CLAWBOT via SSH and return stdout."""
    client = _ssh_connect()
    # Use single quotes to prevent bash from expanding $ in mongosh queries
    escaped = eval_str.replace("'", "'\\''")
    cmd = f"mongosh coloring_store --quiet --eval '{escaped}'"
    _, stdout, stderr = client.exec_command(cmd, timeout=10)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    client.close()
    return out


def _mask_email(email: str) -> str:
    """Mask email like j***@gmail.com."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        return f"*@{domain}"
    return f"{local[0]}***@{domain}"


def _fetch_store_summary() -> dict:
    """Fetch store summary from MongoDB on CLAWBOT via SSH + mongosh."""
    now = time.time()
    if _store_summary_cache["data"] is not None and (now - _store_summary_cache["timestamp"]) < STORE_CACHE_TTL:
        return _store_summary_cache["data"]

    default = {
        "total_products": 0,
        "active_products": 0,
        "total_orders": 0,
        "orders_today": 0,
        "revenue_today": 0,
        "total_revenue": 0,
        "total_subscribers": 0,
    }

    try:
        total_products = int(_ssh_mongosh("db.products.countDocuments({})") or 0)
        active_products = int(_ssh_mongosh("db.products.countDocuments({status: 'active'})") or 0)
        total_orders = int(_ssh_mongosh("db.payment_transactions.countDocuments({})") or 0)
        total_subscribers = int(_ssh_mongosh("db.newsletter_subscribers.countDocuments({})") or 0)

        # Orders today (created_at starts with today's date string)
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        orders_today_raw = _ssh_mongosh(
            f"db.payment_transactions.countDocuments({{created_at: {{$regex: /^{today_str}/}}}})"
        )
        orders_today = int(orders_today_raw or 0)

        # Total revenue (amount_cents is in cents, divide by 100)
        total_rev_raw = _ssh_mongosh(
            "JSON.stringify(db.payment_transactions.aggregate([{$group:{_id:null,t:{$sum:'$amount_cents'}}}]).toArray())"
        )
        total_revenue = 0.0
        if total_rev_raw:
            try:
                clean = total_rev_raw.strip()
                start = clean.find('[')
                if start >= 0:
                    clean = clean[start:]
                agg = json.loads(clean)
                if agg:
                    total_revenue = float(agg[0].get("t", 0)) / 100.0
            except (json.JSONDecodeError, IndexError, TypeError):
                pass

        # Revenue today
        rev_today_raw = _ssh_mongosh(
            f"JSON.stringify(db.payment_transactions.aggregate([{{$match:{{created_at:{{$regex:/^{today_str}/}}}}}},{{$group:{{_id:null,t:{{$sum:'$amount_cents'}}}}}}]).toArray())"
        )
        revenue_today = 0.0
        if rev_today_raw:
            try:
                clean = rev_today_raw.strip()
                start = clean.find('[')
                if start >= 0:
                    clean = clean[start:]
                agg = json.loads(clean)
                if agg:
                    revenue_today = float(agg[0].get("t", 0)) / 100.0
            except (json.JSONDecodeError, IndexError, TypeError):
                pass

        result = {
            "total_products": total_products,
            "active_products": active_products,
            "total_orders": total_orders,
            "orders_today": orders_today,
            "revenue_today": round(revenue_today, 2),
            "total_revenue": round(total_revenue, 2),
            "total_subscribers": total_subscribers,
        }

        _store_summary_cache["data"] = result
        _store_summary_cache["timestamp"] = now
        return result
    except Exception:
        return _store_summary_cache["data"] or default


def _fetch_recent_orders() -> list[dict]:
    """Fetch last 20 transactions from payment_transactions on CLAWBOT via SSH + mongosh."""
    now = time.time()
    if _store_orders_cache["data"] is not None and (now - _store_orders_cache["timestamp"]) < STORE_CACHE_TTL:
        return _store_orders_cache["data"]

    try:
        raw = _ssh_mongosh(
            "JSON.stringify(db.payment_transactions.find({}).sort({created_at:-1}).limit(20).toArray())"
        )
        if not raw:
            return []

        orders = json.loads(raw)
        result = []
        for o in orders:
            # product_names is an array of strings like ["Mandala Serenity x1"]
            products = o.get("product_names", [])
            if not isinstance(products, list):
                products = []

            created = o.get("created_at")
            if isinstance(created, dict) and "$date" in created:
                try:
                    dt = datetime.fromisoformat(created["$date"].replace("Z", "+00:00"))
                    created_str = dt.strftime("%Y-%m-%d %H:%M")
                except (ValueError, TypeError):
                    created_str = str(created["$date"])[:16]
            elif isinstance(created, str):
                created_str = created[:16]
            else:
                created_str = "—"

            email = o.get("user_email", "")
            amount_cents = o.get("amount_cents", 0)
            if isinstance(amount_cents, dict):
                amount_cents = amount_cents.get("$numberInt", amount_cents.get("$numberDouble", 0))
            amount = float(amount_cents) / 100.0 if amount_cents else 0.0

            oid = o.get("_id", "")
            if isinstance(oid, dict):
                oid = oid.get("$oid", str(oid))

            result.append({
                "id": str(oid),
                "email": _mask_email(email),
                "amount": round(amount, 2),
                "status": o.get("payment_status", "unknown"),
                "created_at": created_str,
                "products": products,
            })

        _store_orders_cache["data"] = result
        _store_orders_cache["timestamp"] = now
        return result
    except Exception:
        return _store_orders_cache["data"] or []


@app.get("/api/kofi/stats")
def get_kofi_stats():
    try:
        total_raw = _ssh_mongosh(
            "JSON.stringify(db.kofi_transactions.aggregate([{$group:{_id:null,total:{$sum:'$amount'},count:{$sum:1}}}]).toArray())"
        )
        total_revenue = 0.0
        total_orders = 0
        if total_raw:
            try:
                clean = total_raw.strip()
                start = clean.find('[')
                if start >= 0:
                    clean = clean[start:]
                agg = json.loads(clean)
                if agg:
                    total_revenue = float(agg[0].get("total", 0))
                    total_orders = int(agg[0].get("count", 0))
            except Exception:
                pass

        recent_raw = _ssh_mongosh(
            "JSON.stringify(db.kofi_transactions.find({},{amount:1,type:1,email:1,timestamp:1,shop_items:1,_id:0}).sort({received_at:-1}).limit(10).toArray())"
        )
        recent = []
        if recent_raw:
            try:
                clean = recent_raw.strip()
                start = clean.find('[')
                if start >= 0:
                    clean = clean[start:]
                recent = json.loads(clean)
            except Exception:
                pass

        return {
            "total_revenue": round(total_revenue, 2),
            "total_orders": total_orders,
            "recent": recent
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


@app.get("/api/store/summary")
async def store_summary():
    return _fetch_store_summary()


@app.get("/api/store/recent-orders")
async def store_recent_orders():
    return {"orders": _fetch_recent_orders()}


_kofi_summary_cache = {"data": None, "timestamp": 0}
_kofi_queue_cache = {"data": None, "timestamp": 0}
_kofi_processed_cache = {"data": None, "timestamp": 0}
KOFI_CACHE_TTL = 15  # seconds
KOFI_DIR = "/home/clarence/kofi-uploads"


def _parse_ls_line(line: str) -> dict | None:
    """Parse an 'ls -la' output line into {filename, size, timestamp}."""
    # Example: -rw-r--r-- 1 clarence clarence 12345 Mar 12 14:30 file.png
    parts = line.split(None, 8)
    if len(parts) < 9:
        return None
    if parts[0].startswith("d") or parts[0].startswith("total"):
        return None
    filename = parts[8]
    if filename in (".", ".."):
        return None
    try:
        size = int(parts[4])
    except ValueError:
        size = 0
    # Timestamp from month day time/year (columns 5-7)
    timestamp = f"{parts[5]} {parts[6]} {parts[7]}"
    return {"filename": filename, "size": size, "timestamp": timestamp}


def _ssh_ls_files(dirpath: str) -> list[dict]:
    """List files in a directory on CLAWBOT via SSH, parsed from ls -la."""
    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(f"ls -la {dirpath}/ 2>/dev/null")
        raw = stdout.read().decode("utf-8", errors="replace")
        client.close()

        files = []
        for line in raw.strip().splitlines():
            parsed = _parse_ls_line(line)
            if parsed:
                files.append(parsed)
        return files
    except Exception:
        return []


def _fetch_kofi_summary() -> dict:
    """Fetch Ko-fi pipeline summary via SSH."""
    now = time.time()
    if _kofi_summary_cache["data"] is not None and (now - _kofi_summary_cache["timestamp"]) < KOFI_CACHE_TTL:
        return _kofi_summary_cache["data"]

    default = {
        "queue_count": 0,
        "processed_count": 0,
        "failed_count": 0,
        "last_processed": None,
        "pipeline_status": "unknown",
    }

    try:
        queue_files = _ssh_ls_files(f"{KOFI_DIR}/queue")
        processed_files = _ssh_ls_files(f"{KOFI_DIR}/processed")
        failed_files = _ssh_ls_files(f"{KOFI_DIR}/failed")

        # Last processed: most recent file in processed (ls -la is alphabetical, sort by timestamp)
        last_processed = None
        if processed_files:
            last = processed_files[-1]
            last_processed = {"filename": last["filename"], "timestamp": last["timestamp"]}

        # Pipeline status: active if queue has files, idle otherwise
        pipeline_status = "active" if queue_files else "idle"

        # Try to read most recent pipeline log
        pipeline_log = None
        try:
            client = _ssh_connect()
            _, stdout, _ = client.exec_command(
                f"ls -t {KOFI_DIR}/*.log {KOFI_DIR}/logs/*.log 2>/dev/null | head -1 | xargs -r tail -5"
            )
            log_raw = stdout.read().decode("utf-8", errors="replace").strip()
            client.close()
            if log_raw:
                pipeline_log = log_raw
        except Exception:
            pass

        result = {
            "queue_count": len(queue_files),
            "processed_count": len(processed_files),
            "failed_count": len(failed_files),
            "last_processed": last_processed,
            "pipeline_status": pipeline_status,
            "pipeline_log": pipeline_log,
        }

        _kofi_summary_cache["data"] = result
        _kofi_summary_cache["timestamp"] = now
        return result
    except Exception:
        return _kofi_summary_cache["data"] or default


def _fetch_kofi_queue() -> list[dict]:
    """Fetch files currently in Ko-fi queue."""
    now = time.time()
    if _kofi_queue_cache["data"] is not None and (now - _kofi_queue_cache["timestamp"]) < KOFI_CACHE_TTL:
        return _kofi_queue_cache["data"]

    files = _ssh_ls_files(f"{KOFI_DIR}/queue")
    _kofi_queue_cache["data"] = files
    _kofi_queue_cache["timestamp"] = now
    return files


def _fetch_kofi_processed() -> list[dict]:
    """Fetch last 10 processed Ko-fi files."""
    now = time.time()
    if _kofi_processed_cache["data"] is not None and (now - _kofi_processed_cache["timestamp"]) < KOFI_CACHE_TTL:
        return _kofi_processed_cache["data"]

    files = _ssh_ls_files(f"{KOFI_DIR}/processed")
    # Last 10, newest last in ls output so reverse for newest-first
    files = list(reversed(files))[:10]
    _kofi_processed_cache["data"] = files
    _kofi_processed_cache["timestamp"] = now
    return files


@app.get("/api/kofi/summary")
async def kofi_summary():
    return _fetch_kofi_summary()


@app.get("/api/kofi/queue")
async def kofi_queue():
    return {"files": _fetch_kofi_queue()}


@app.get("/api/kofi/processed")
async def kofi_processed():
    return {"files": _fetch_kofi_processed()}


# ── Tasks / Command endpoints ─────────────────────────────────────────

class SendCommandBody(BaseModel):
    message: str
    agent: str = "main"


_AGENT_TARGETS = {
    "main": {"to": "8507470773", "agent": "main"},
    "business": {"to": "8507470773", "agent": "business"},
    "research": {"to": "8507470773", "agent": "research"},
    "coder": {"to": "8507470773", "agent": "coder"},
}


def _load_tasks_history() -> list[dict]:
    if TASKS_HISTORY_FILE.exists():
        try:
            return json.loads(TASKS_HISTORY_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return []


def _save_tasks_history(history: list[dict]):
    TASKS_HISTORY_FILE.write_text(json.dumps(history, indent=2))


@app.post("/api/tasks/send")
async def tasks_send(body: SendCommandBody):
    message = body.message.strip()
    agent = body.agent.strip().lower()
    if not message:
        return {"success": False, "error": "Message is empty"}

    sent_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Prepend system instruction for sub-agents
    _AGENT_INSTRUCTIONS = {
        "business": "[INST] You are a business advisor. Answer directly with practical, actionable business advice. Do NOT use any tools, subagents, or file operations. [/INST] ",
        "research": "[INST] You are a research assistant. Answer directly with well-researched, informative answers. Do NOT use any tools, subagents, or file operations. [/INST] ",
        "coder": "[INST] You are a coding assistant. Answer directly with code and technical explanations. Do NOT use any tools, subagents, or file operations. [/INST] ",
    }

    # Build the command
    if agent == "paige":
        safe_msg = message.replace("'", "'\\''")
        cmd = f"cd /home/clarence/paige && python3 paige.py --topic '{safe_msg}'"
    else:
        target = _AGENT_TARGETS.get(agent, _AGENT_TARGETS["main"])
        full_msg = _AGENT_INSTRUCTIONS.get(agent, "") + message
        safe_msg = full_msg.replace("'", "'\\''")
        session_flag = f" --session-id {uuid.uuid4()}" if agent in ("business", "research", "coder") else ""
        cmd = f"/home/clarence/.npm-global/bin/openclaw agent --channel telegram --to {target['to']} --agent {target['agent']} --message '{safe_msg}' --deliver --reply-channel telegram --reply-to {target['to']}{session_flag}"

    try:
        client = _ssh_connect()
        _, stdout, stderr = client.exec_command(cmd, timeout=300)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        success = "error" not in (err or "").lower()
        response = out or err or None

        # Jarvis (main) and Paige: execute immediately, no queue
        if agent in ("main", "paige"):
            client.close()
            history = _load_tasks_history()
            history.insert(0, {
                "message": message,
                "agent": agent,
                "sent_at": sent_at,
                "status": "sent" if success else "failed",
                "response": response,
            })
            _save_tasks_history(history[:50])
            return {"success": success, "sent_at": sent_at, "response": response}

        # Business, Research, Coder: save response to pending queue for review
        task_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        filename = f"{task_id}-{agent}.json"
        task_data = {
            "agent": agent,
            "task": message,
            "response": response,
            "timestamp": sent_at,
            "exec_success": success,
        }

        sftp = client.open_sftp()
        with sftp.open(f"{AGENT_QUEUE_PENDING}/{filename}", "w") as f:
            f.write(json.dumps(task_data, indent=2))
        sftp.close()
        client.close()

        history = _load_tasks_history()
        history.insert(0, {
            "message": message,
            "agent": agent,
            "sent_at": sent_at,
            "status": "pending_review",
            "response": response,
        })
        _save_tasks_history(history[:50])

        return {"success": True, "status": "pending_review", "sent_at": sent_at, "response": response}
    except Exception as e:
        history = _load_tasks_history()
        history.insert(0, {
            "message": message,
            "agent": agent,
            "sent_at": sent_at,
            "status": "failed",
            "response": str(e),
        })
        _save_tasks_history(history[:50])
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred", "sent_at": sent_at}


@app.get("/api/tasks/history")
async def tasks_history():
    history = _load_tasks_history()
    return {"history": history[:20]}


@app.get("/api/tasks/pending")
async def tasks_pending():
    try:
        client = _ssh_connect()
        cmd = f"find {AGENT_QUEUE_PENDING} -name '*.json' -printf '%f\\n' 2>/dev/null | sort -r"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        filenames = [f.strip() for f in stdout.read().decode("utf-8", errors="replace").strip().splitlines() if f.strip()]

        tasks = []
        sftp = client.open_sftp()
        for fname in filenames:
            try:
                with sftp.open(f"{AGENT_QUEUE_PENDING}/{fname}", "r") as f:
                    data = json.loads(f.read().decode("utf-8"))
                data["filename"] = fname
                tasks.append(data)
            except Exception:
                pass
        sftp.close()
        client.close()
        return {"tasks": tasks}
    except Exception:
        return {"tasks": []}


@app.delete("/api/tasks/pending/{filename:path}")
async def tasks_delete_pending(filename: str):
    filename = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()
        sftp.remove(f"{AGENT_QUEUE_PENDING}/{filename}")
        sftp.close()
        client.close()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.delete("/api/tasks/history/{filename:path}")
async def tasks_delete_history_entry(filename: str):
    filename = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()
        # Try removing from approved and denied
        txt_name = _safe_remote_filename(filename.replace(".json", ".txt"))
        for folder in (AGENT_QUEUE_APPROVED, AGENT_QUEUE_DENIED):
            try:
                sftp.remove(f"{folder}/{filename}")
            except FileNotFoundError:
                pass
            # Also remove .txt variant
            try:
                sftp.remove(f"{folder}/{txt_name}")
            except FileNotFoundError:
                pass
        sftp.close()
        client.close()
        # Also remove local .txt if it exists
        local_txt = AGENT_RESPONSES_DIR / txt_name
        if local_txt.exists():
            local_txt.unlink()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.delete("/api/tasks/saved-responses/{filename:path}")
async def tasks_delete_saved_response(filename: str):
    safe_name = Path(filename).name
    filepath = AGENT_RESPONSES_DIR / safe_name
    if not filepath.exists():
        return {"success": False, "error": "File not found"}
    try:
        filepath.unlink()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


class ApproveTaskBody(BaseModel):
    destination: str = "telegram"  # "telegram" or "file"


class DenyTaskBody(BaseModel):
    reason: str = ""


@app.post("/api/tasks/approve/{filename:path}")
async def tasks_approve(filename: str, body: ApproveTaskBody = ApproveTaskBody()):
    filename = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()

        # Read the task
        with sftp.open(f"{AGENT_QUEUE_PENDING}/{filename}", "r") as f:
            task = json.loads(f.read().decode("utf-8"))

        agent = task.get("agent", "main")
        response = task.get("response", "")
        original_task = task.get("task", "")

        task["approved_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        task["status"] = "approved"
        task["destination"] = body.destination

        if body.destination == "telegram":
            # Send the response to Telegram
            target = _AGENT_TARGETS.get(agent, _AGENT_TARGETS["main"])
            safe_resp = (response or "No response").replace("'", "'\\''")
            cmd = (
                f"/home/clarence/.npm-global/bin/openclaw agent --channel telegram "
                f"--to {target['to']} --agent {target['agent']} "
                f"--message '{safe_resp}' --deliver --reply-channel telegram --reply-to {target['to']}"
            )
            _, stdout, stderr = client.exec_command(cmd, timeout=60)
            stdout.read()
            _send_telegram_phyllis(f"✅ Approved ({agent}): {original_task[:80]}")
        else:
            # Save as text file on CLAWBOT
            txt_filename = _safe_remote_filename(filename.replace(".json", ".txt"))
            txt_content = f"Agent: {agent}\nTask: {original_task}\nTimestamp: {task.get('timestamp', '')}\nApproved: {task['approved_at']}\n\n--- Response ---\n{response or 'No response'}\n"
            with sftp.open(f"{AGENT_QUEUE_APPROVED}/{txt_filename}", "w") as f:
                f.write(txt_content)

            # Also save locally on Windows
            local_dir = Path(r"C:\Users\clare\Documents\agent-responses")
            local_dir.mkdir(parents=True, exist_ok=True)
            safe_local = safe_path(str(local_dir), txt_filename)
            Path(safe_local).write_text(txt_content, encoding="utf-8")

        # Move JSON to approved
        with sftp.open(f"{AGENT_QUEUE_APPROVED}/{filename}", "w") as f:
            f.write(json.dumps(task, indent=2))
        sftp.remove(f"{AGENT_QUEUE_PENDING}/{filename}")
        sftp.close()
        client.close()

        # Update local history
        history = _load_tasks_history()
        for h in history:
            if h.get("message") == original_task and h.get("status") == "pending_review":
                h["status"] = "approved"
                break
        _save_tasks_history(history[:50])

        dest_label = "Telegram" if body.destination == "telegram" else "file"
        return {"success": True, "message": f"Approved and sent to {dest_label}: {agent}"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.post("/api/tasks/deny/{filename:path}")
async def tasks_deny(filename: str, body: DenyTaskBody = DenyTaskBody()):
    filename = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()

        # Read the task
        with sftp.open(f"{AGENT_QUEUE_PENDING}/{filename}", "r") as f:
            task = json.loads(f.read().decode("utf-8"))

        agent = task.get("agent", "main")
        original_task = task.get("task", "")
        reason = body.reason or "No specific feedback given"

        # Send the task back to the agent with feedback
        redo_msg = f"Please redo this task. Feedback: {reason}\n\nOriginal task: {original_task}"
        target = _AGENT_TARGETS.get(agent, _AGENT_TARGETS["main"])
        safe_msg = redo_msg.replace("'", "'\\''")
        cmd = (
            f"/home/clarence/.npm-global/bin/openclaw agent --channel telegram "
            f"--to {target['to']} --agent {target['agent']} "
            f"--message '{safe_msg}' --deliver --reply-channel telegram --reply-to {target['to']}"
        )
        _, stdout, stderr = client.exec_command(cmd, timeout=300)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        redo_response = out or err or None

        # Save denied task with redo response
        task["denied_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        task["status"] = "denied"
        task["reason"] = body.reason
        task["redo_response"] = redo_response

        # The redo response goes into a new pending task
        new_task_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        new_filename = f"{new_task_id}-{agent}-redo.json"
        new_task = {
            "agent": agent,
            "task": original_task,
            "response": redo_response,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "exec_success": True,
            "is_redo": True,
            "deny_reason": body.reason,
        }
        with sftp.open(f"{AGENT_QUEUE_PENDING}/{new_filename}", "w") as f:
            f.write(json.dumps(new_task, indent=2))

        # Move original to denied
        with sftp.open(f"{AGENT_QUEUE_DENIED}/{filename}", "w") as f:
            f.write(json.dumps(task, indent=2))
        sftp.remove(f"{AGENT_QUEUE_PENDING}/{filename}")
        sftp.close()
        client.close()

        # Update local history
        history = _load_tasks_history()
        for h in history:
            if h.get("message") == original_task and h.get("status") == "pending_review":
                h["status"] = "denied"
                break
        history.insert(0, {
            "message": original_task,
            "agent": agent,
            "sent_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            "status": "pending_review",
            "response": redo_response,
        })
        _save_tasks_history(history[:50])

        return {"success": True, "message": f"Denied and re-sent to {agent} with feedback"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.get("/api/tasks/queue-history")
async def tasks_queue_history():
    try:
        client = _ssh_connect()
        approved = []
        denied = []

        # Read approved
        cmd = f"find {AGENT_QUEUE_APPROVED} -name '*.json' -printf '%f\\n' 2>/dev/null | sort -r | head -20"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        filenames = [f.strip() for f in stdout.read().decode("utf-8", errors="replace").strip().splitlines() if f.strip()]
        sftp = client.open_sftp()
        for fname in filenames:
            try:
                with sftp.open(f"{AGENT_QUEUE_APPROVED}/{fname}", "r") as f:
                    data = json.loads(f.read().decode("utf-8"))
                data["filename"] = fname
                approved.append(data)
            except Exception:
                pass

        # Read denied
        cmd = f"find {AGENT_QUEUE_DENIED} -name '*.json' -printf '%f\\n' 2>/dev/null | sort -r | head -20"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        filenames = [f.strip() for f in stdout.read().decode("utf-8", errors="replace").strip().splitlines() if f.strip()]
        for fname in filenames:
            try:
                with sftp.open(f"{AGENT_QUEUE_DENIED}/{fname}", "r") as f:
                    data = json.loads(f.read().decode("utf-8"))
                data["filename"] = fname
                denied.append(data)
            except Exception:
                pass

        sftp.close()
        client.close()
        return {"approved": approved, "denied": denied}
    except Exception:
        return {"approved": [], "denied": []}


AGENT_RESPONSES_DIR = Path(r"C:\Users\clare\Documents\agent-responses")


@app.get("/api/tasks/saved-responses")
async def tasks_saved_responses():
    if not AGENT_RESPONSES_DIR.exists():
        return {"responses": []}
    responses = []
    for f in sorted(AGENT_RESPONSES_DIR.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)[:20]:
        content = f.read_text(encoding="utf-8", errors="replace")
        # Parse the header fields
        lines = content.split("\n")
        meta = {}
        for line in lines:
            if line.startswith("Agent: "):
                meta["agent"] = line[7:]
            elif line.startswith("Task: "):
                meta["task"] = line[6:]
            elif line.startswith("Timestamp: "):
                meta["timestamp"] = line[11:]
            elif line.startswith("Approved: "):
                meta["approved_at"] = line[10:]
            elif line.startswith("--- Response ---"):
                break
        # Everything after "--- Response ---"
        resp_start = content.find("--- Response ---")
        response_text = content[resp_start + 16:].strip() if resp_start != -1 else content
        responses.append({
            "filename": f.name,
            "agent": meta.get("agent", ""),
            "task": meta.get("task", ""),
            "timestamp": meta.get("timestamp", ""),
            "approved_at": meta.get("approved_at", ""),
            "response": response_text,
        })
    return {"responses": responses}


@app.get("/api/tasks/saved-responses/{filename}")
async def tasks_download_response(filename: str):
    safe_name = Path(filename).name  # prevent path traversal
    filepath = AGENT_RESPONSES_DIR / safe_name
    if not filepath.exists():
        return PlainTextResponse("File not found", status_code=404)
    content = filepath.read_text(encoding="utf-8", errors="replace")
    return PlainTextResponse(
        content,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@app.get("/api/tasks/scheduled")
async def tasks_scheduled():
    try:
        client = _ssh_connect()
        _, stdout, stderr = client.exec_command("openclaw cron list --json 2>/dev/null || openclaw cron list 2>/dev/null", timeout=10)
        raw = stdout.read().decode("utf-8", errors="replace").strip()
        client.close()

        if not raw:
            return {"tasks": []}

        # Try JSON parse first
        try:
            tasks = json.loads(raw)
            if isinstance(tasks, list):
                return {"tasks": tasks}
            if isinstance(tasks, dict) and "tasks" in tasks:
                return {"tasks": tasks["tasks"]}
            return {"tasks": []}
        except json.JSONDecodeError:
            # Parse plain text: each line is a cron entry
            tasks = []
            for line in raw.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Try to split: "schedule | message" or "* * * * * command"
                parts = line.split("|", 1)
                if len(parts) == 2:
                    tasks.append({"schedule": parts[0].strip(), "message": parts[1].strip()})
                else:
                    # Assume first 5 fields are cron, rest is message
                    fields = line.split(None, 5)
                    if len(fields) >= 6:
                        tasks.append({"schedule": " ".join(fields[:5]), "message": fields[5]})
                    else:
                        tasks.append({"schedule": "", "message": line})
            return {"tasks": tasks}
    except Exception:
        return {"tasks": []}


class ScheduleTaskBody(BaseModel):
    schedule: str
    message: str


@app.post("/api/tasks/schedule")
async def tasks_schedule(body: ScheduleTaskBody):
    schedule = body.schedule.strip()
    message = body.message.strip()
    if not schedule or not message:
        return {"success": False, "error": "Schedule and message are required"}

    safe_schedule = schedule.replace("'", "'\\''")
    safe_msg = message.replace("'", "'\\''")
    cmd = f"openclaw cron add --schedule '{safe_schedule}' --message '{safe_msg}'"

    try:
        client = _ssh_connect()
        _, stdout, stderr = client.exec_command(cmd, timeout=10)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        client.close()

        success = "error" not in (err or "").lower()
        return {"success": success, "response": out or err or None}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.delete("/api/tasks/scheduled/{task_id}")
async def tasks_delete_scheduled(task_id: str):
    safe_id = task_id.replace("'", "'\\''")
    cmd = f"openclaw cron remove '{safe_id}'"
    try:
        client = _ssh_connect()
        _, stdout, stderr = client.exec_command(cmd, timeout=10)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        client.close()
        return {"success": True, "response": out or err or None}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.get("/api/openclaw/config")
async def openclaw_config():
    config = ssh_read_openclaw_config()
    if config is None:
        return {"error": "Could not read OpenClaw config via SSH"}
    return config


# ---------------------------------------------------------------------------
# Paige – AI Blog Writer for Phyllis Dianne Studio
# ---------------------------------------------------------------------------

PAIGE_DIR = "/home/clarence/paige"
PAIGE_STAGED = f"{PAIGE_DIR}/staged"
PAIGE_PROCESSED = f"{PAIGE_DIR}/processed"
PAIGE_REJECTED = f"{PAIGE_DIR}/rejected"
PHYLLIS_BLOG_DIR = "/home/clarence/PhyllisDiAnneStudio-App/frontend/public/blog"
PHYLLIS_APP_DIR = "/home/clarence/PhyllisDiAnneStudio-App"
PHYLLIS_CHAT_ID = "1540152448"
PHYLLIS_BOT_TOKEN = os.getenv("PHYLLIS_BOT_TOKEN", "")

_paige_status_cache = {"data": None, "timestamp": 0}
PAIGE_CACHE_TTL = 15


def _parse_frontmatter(raw: str) -> dict:
    """Extract YAML frontmatter fields from markdown text."""
    meta = {"title": "", "date": "", "description": ""}
    if not raw.startswith("---"):
        return meta
    end = raw.find("---", 3)
    if end == -1:
        return meta
    block = raw[3:end]
    for line in block.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().lower()
            val = val.strip().strip('"').strip("'")
            if key in meta:
                meta[key] = val
    return meta


def _send_telegram_phyllis(message: str):
    """Send a Telegram message to Phyllis via SSH curl."""
    safe = message.replace("'", "'\\''")
    cmd = (
        f"curl -s -X POST 'https://api.telegram.org/bot{PHYLLIS_BOT_TOKEN}/sendMessage' "
        f"-d chat_id={PHYLLIS_CHAT_ID} -d text='{safe}' -d parse_mode=HTML"
    )
    try:
        client = _ssh_connect()
        client.exec_command(cmd, timeout=10)
        client.close()
    except Exception:
        pass


@app.get("/api/paige/status")
async def paige_status():
    now = time.time()
    if _paige_status_cache["data"] is not None and (now - _paige_status_cache["timestamp"]) < PAIGE_CACHE_TTL:
        return _paige_status_cache["data"]

    try:
        client = _ssh_connect()
        cmd = (
            "systemctl is-active paige-webhook.service 2>/dev/null | grep -qx active && echo ONLINE || echo OFFLINE; "
            f"find {PAIGE_STAGED} -name '*.md' 2>/dev/null | wc -l; "
            f"find {PAIGE_PROCESSED} -name '*.md' 2>/dev/null | wc -l; "
            f"find {PAIGE_REJECTED} -name '*.md' 2>/dev/null | wc -l"
        )
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        lines = stdout.read().decode("utf-8", errors="replace").strip().splitlines()
        client.close()

        result = {
            "status": "online" if lines[0].strip() == "ONLINE" else "offline",
            "staged_count": int(lines[1].strip()) if len(lines) > 1 else 0,
            "processed_count": int(lines[2].strip()) if len(lines) > 2 else 0,
            "rejected_count": int(lines[3].strip()) if len(lines) > 3 else 0,
        }
        _paige_status_cache["data"] = result
        _paige_status_cache["timestamp"] = now
        return result
    except Exception:
        return _paige_status_cache["data"] or {
            "status": "offline",
            "staged_count": 0,
            "processed_count": 0,
            "rejected_count": 0,
        }


@app.get("/api/paige/staged")
async def paige_staged():
    try:
        client = _ssh_connect()
        # List .md files with sizes
        cmd = f"find {PAIGE_STAGED} -name '*.md' -printf '%f\\n' 2>/dev/null"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        filenames = [f.strip() for f in stdout.read().decode("utf-8", errors="replace").strip().splitlines() if f.strip()]

        posts = []
        for fname in filenames:
            filepath = f"{PAIGE_STAGED}/{fname}"
            cmd2 = f"cat '{filepath}' 2>/dev/null; echo '___PAIGE_SIZE___'; stat -c%s '{filepath}' 2>/dev/null"
            _, stdout2, _ = client.exec_command(cmd2, timeout=10)
            output = stdout2.read().decode("utf-8", errors="replace")
            parts = output.rsplit("___PAIGE_SIZE___", 1)
            content = parts[0].strip() if parts else ""
            size = int(parts[1].strip()) if len(parts) > 1 and parts[1].strip().isdigit() else 0
            meta = _parse_frontmatter(content)

            # Strip frontmatter for preview
            body = content
            if body.startswith("---"):
                end = body.find("---", 3)
                if end != -1:
                    body = body[end + 3:].strip()

            posts.append({
                "filename": fname,
                "title": meta["title"] or fname.replace(".md", "").replace("-", " ").title(),
                "date": meta["date"],
                "description": meta["description"],
                "preview": body[:500],
                "size": size,
            })

        client.close()
        return {"posts": posts}
    except Exception:
        return {"posts": []}


@app.get("/api/paige/staged/{filename:path}")
async def paige_staged_file(filename: str):
    safe = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        cmd = f"cat '{PAIGE_STAGED}/{safe}'"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        content = stdout.read().decode("utf-8", errors="replace")
        client.close()

        meta = _parse_frontmatter(content)
        body = content
        if body.startswith("---"):
            end = body.find("---", 3)
            if end != -1:
                body = body[end + 3:].strip()
        return {
            "filename": filename,
            "title": meta["title"] or filename.replace(".md", "").replace("-", " ").title(),
            "date": meta["date"],
            "description": meta["description"],
            "content": content,
            "body": body,
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


class EditStagedBody(BaseModel):
    title: str
    body: str


@app.put("/api/paige/staged/{filename:path}")
async def paige_staged_edit(filename: str, payload: EditStagedBody):
    safe = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        # Read existing file to preserve frontmatter
        _, stdout, _ = client.exec_command(f"cat '{PAIGE_STAGED}/{safe}'", timeout=10)
        content = stdout.read().decode("utf-8", errors="replace")

        # Rebuild frontmatter with updated title, preserve other fields
        meta = _parse_frontmatter(content)
        fm_lines = [
            "---",
            f'title: "{payload.title}"',
        ]
        if meta["date"]:
            fm_lines.append(f'date: "{meta["date"]}"')
        if meta["description"]:
            fm_lines.append(f'description: "{meta["description"]}"')
        fm_lines.append("---")

        new_content = "\n".join(fm_lines) + "\n\n" + payload.body.strip() + "\n"

        # Write back via sftp
        sftp = client.open_sftp()
        filepath = f"{PAIGE_STAGED}/{safe}"
        with sftp.open(filepath, "w") as f:
            f.write(new_content)
        sftp.close()
        client.close()
        return {"success": True, "message": "Post updated"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.post("/api/paige/approve/{filename:path}")
async def paige_approve(filename: str, body: dict = None):
    safe = filename.replace("'", "'\\''")
    scheduled_date = (body or {}).get("scheduled_date", "")
    req_category = (body or {}).get("category", "")
    req_tags = (body or {}).get("tags", [])
    try:
        client = _ssh_connect()

        # Read full file content for frontmatter + body
        _, stdout, _ = client.exec_command(f"cat '{PAIGE_STAGED}/{safe}'", timeout=10)
        content = stdout.read().decode("utf-8", errors="replace")
        meta = _parse_frontmatter(content)
        title = meta["title"] or filename.replace(".md", "").replace("-", " ").title()
        safe_title = title.replace("'", "'\\''")

        # Strip frontmatter to get body
        body = content
        if body.startswith("---"):
            end = body.find("---", 3)
            if end != -1:
                body = body[end + 3:].strip()

        # Clean body before posting to MongoDB
        # Strip **bold** markers but keep the text content
        body = re.sub(r'\*\*(.+?)\*\*', r'\1', body)
        # Remove ==== separator lines
        body = re.sub(r'^=+\s*$', '', body, flags=re.MULTILINE)
        # Remove --- separator lines (3+ dashes only, preserves - list items)
        body = re.sub(r'^-{3,}\s*$', '', body, flags=re.MULTILINE)
        # Remove [Image description:...] lines
        body = re.sub(r'^\[Image description:.*?\]\s*', '', body, flags=re.MULTILINE)
        # Remove [Insert image] lines
        body = re.sub(r'^\[Insert image\]\s*$', '', body, flags=re.MULTILINE)
        # Remove #### heading lines
        body = re.sub(r'^####\s+.*$', '', body, flags=re.MULTILINE)
        body = body.strip()

        # Post to Phyllis blog API
        import requests
        try:
            requests.post(
                "http://192.168.0.130:8001/api/admin/blog",
                json={
                    "title": title,
                    "body": body,
                    "date_published": scheduled_date or meta.get("date", ""),
                    "category": req_category or meta.get("category", ""),
                    "tags": req_tags or [t.strip() for t in meta.get("tags", "").strip("[]").split(",") if t.strip()],
                },
                headers={"x-admin-token": "phyllis-admin-token-2024"},
                timeout=10,
            )
        except Exception:
            pass  # non-blocking; file deploy below is the primary path

        # Copy to blog dir, git commit, rebuild, move to processed
        sudo_pass = os.getenv("SUDO_PASS", "")
        cmds = " && ".join([
            f"cp '{PAIGE_STAGED}/{safe}' '{PHYLLIS_BLOG_DIR}/{safe}'",
            f"cd {PHYLLIS_APP_DIR} && git add -A && git commit -m 'Paige: publish {safe_title}' && git push",
            f"cd {PHYLLIS_APP_DIR}/frontend && npm run build && echo '{sudo_pass}' | sudo -S systemctl reload nginx",
            f"mv '{PAIGE_STAGED}/{safe}' '{PAIGE_PROCESSED}/{safe}'",
        ])
        _, stdout, stderr = client.exec_command(cmds, timeout=120)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        client.close()

        # Send Telegram notification
        _send_telegram_phyllis(
            f"✅ Blog post published! Title: {title} — Live at https://phyllisdiannestudio.com/blog"
        )

        # Invalidate status cache
        _paige_status_cache["data"] = None

        return {"success": True, "message": f"Published: {title}"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.post("/api/paige/reject/{filename:path}")
async def paige_reject(filename: str, body: dict = None):
    filename = _safe_remote_filename(filename)
    reason = (body or {}).get("reason", "").strip()
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()
        staged = f"{PAIGE_STAGED}/{filename}"
        rejected = f"{PAIGE_REJECTED}/{filename}"

        # Read title before moving
        title = filename
        try:
            with sftp.open(staged, "r") as f:
                content = f.read().decode("utf-8", errors="replace")
            meta = _parse_frontmatter(content)
            title = meta["title"] or filename.replace(".md", "").replace("-", " ").title()
        except Exception:
            pass

        # Move to rejected
        try:
            sftp.rename(staged, rejected)
        except Exception:
            pass

        # Save rejection reason if provided
        if reason:
            notes_path = "/home/clarence/paige/rejection_notes.json"
            try:
                with sftp.open(notes_path, "r") as f:
                    notes = json.loads(f.read().decode())
            except Exception:
                notes = []

            notes.append({
                "title": title,
                "reason": reason,
                "filename": filename,
                "date": datetime.now(timezone.utc).isoformat(),
            })
            notes = notes[-10:]

            with sftp.open(notes_path, "w") as f:
                f.write(json.dumps(notes, indent=2))

        sftp.close()
        client.close()

        _send_telegram_phyllis(f"❌ Post rejected: {title}" + (f"\nReason: {reason}" if reason else ""))
        _paige_status_cache["data"] = None

        return {"success": True, "message": f"Rejected: {title}"}
    except Exception as e:
        logger.error(f"Reject error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.get("/api/paige/processed")
async def paige_processed():
    try:
        client = _ssh_connect()
        cmd = f"find {PAIGE_PROCESSED} -name '*.md' -printf '%f\\n' 2>/dev/null | sort -r"
        _, stdout, _ = client.exec_command(cmd, timeout=10)
        filenames = [f.strip() for f in stdout.read().decode("utf-8", errors="replace").strip().splitlines() if f.strip()]

        posts = []
        for fname in filenames[:20]:  # Limit to 20 most recent
            filepath = f"{PAIGE_PROCESSED}/{fname}"
            cmd2 = f"head -30 '{filepath}' 2>/dev/null"
            _, stdout2, _ = client.exec_command(cmd2, timeout=10)
            content = stdout2.read().decode("utf-8", errors="replace")
            meta = _parse_frontmatter(content)

            # Strip frontmatter for body preview
            body = content
            if body.startswith("---"):
                end = body.find("---", 3)
                if end != -1:
                    body = body[end + 3:].strip()

            # Clean markdown artifacts (preserve headings and list items)
            body = re.sub(r'\*\*(.+?)\*\*', r'\1', body)
            body = re.sub(r'^=+\s*$', '', body, flags=re.MULTILINE)
            body = re.sub(r'^-{3,}\s*$', '', body, flags=re.MULTILINE)
            body = re.sub(r'^\[Image description:.*?\]\s*', '', body, flags=re.MULTILINE)
            # Remove [Insert image] lines
            body = re.sub(r'^\[Insert image\]\s*$', '', body, flags=re.MULTILINE)
            # Remove #### heading lines
            body = re.sub(r'^####\s+.*$', '', body, flags=re.MULTILINE)
            body = body.strip()

            posts.append({
                "filename": fname,
                "title": meta["title"] or fname.replace(".md", "").replace("-", " ").title(),
                "date": meta["date"],
                "body_preview": body[:300],
            })

        client.close()
        return {"posts": posts}
    except Exception:
        return {"posts": []}


@app.get("/api/paige/cron-log")
async def paige_cron_log():
    try:
        client = _ssh_connect()
        _, stdout, _ = client.exec_command(
            "tail -20 /home/clarence/paige/paige.log 2>/dev/null"
        )
        raw = stdout.read().decode("utf-8", errors="replace").strip()
        client.close()

        if not raw:
            return {"lines": [], "last_run": None, "status": "unknown"}

        lines = []
        last_run = None
        has_error = False
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            # Try to split timestamp from message (common format: "2026-03-15 14:00:01 - message")
            ts = ""
            msg = line
            # Match ISO-ish timestamps at start
            ts_match = re.match(r'^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})\s*[-—]\s*(.*)', line)
            if ts_match:
                ts = ts_match.group(1)
                msg = ts_match.group(2)
                last_run = ts
            if re.search(r'error|traceback|exception|failed', line, re.IGNORECASE):
                has_error = True
            lines.append({"timestamp": ts, "message": msg})

        status = "error" if has_error else "success"
        return {"lines": lines, "last_run": last_run, "status": status}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"lines": [], "last_run": None, "status": "error", "error": "An internal error occurred"}


class ResendBody(BaseModel):
    feedback: str = ""


@app.post("/api/paige/resend/{filename:path}")
async def paige_resend(filename: str, body: ResendBody = ResendBody()):
    filename = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()

        # Read the staged file to get the title/topic
        with sftp.open(f"{PAIGE_STAGED}/{filename}", "r") as f:
            content = f.read().decode("utf-8", errors="replace")
        meta = _parse_frontmatter(content)
        title = meta["title"] or filename.replace(".md", "").replace("-", " ").title()

        # Delete the staged file
        sftp.remove(f"{PAIGE_STAGED}/{filename}")
        sftp.close()

        # Build the topic with optional feedback
        topic = title
        if body.feedback.strip():
            topic = f"{title}. Feedback: {body.feedback.strip()}"
        safe_topic = topic.replace("'", "'\\''")

        # Run paige.py with the topic
        cmd = f"cd {PAIGE_DIR} && venv/bin/python paige.py --topic '{safe_topic}'"
        client.exec_command(cmd, timeout=5)
        client.close()

        _send_telegram_phyllis(f"🔄 Paige is rewriting: {title}")
        _paige_status_cache["data"] = None

        return {"success": True, "message": f"Paige is rewriting: {title}"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.post("/api/paige/generate")
async def paige_generate(request: Request):
    try:
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        topic = body.get("topic", "")
        client = _ssh_connect()
        cmd = f"cd {PAIGE_DIR} && venv/bin/python paige.py"
        if topic:
            safe_topic = topic.replace("'", "'\\''")
            cmd += f" --topic '{safe_topic}'"
        client.exec_command(cmd, timeout=5)
        client.close()
        return {"success": True, "message": "Paige is writing a new post..."}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.delete("/api/paige/staged/{filename:path}")
async def paige_delete_staged(filename: str):
    safe = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()
        sftp.remove(f"{PAIGE_STAGED}/{safe}")
        sftp.close()
        client.close()
        _paige_status_cache["data"] = None
        return {"success": True, "message": f"Deleted draft: {filename}"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


@app.delete("/api/paige/processed/{filename:path}")
async def paige_delete_processed(filename: str):
    safe = _safe_remote_filename(filename)
    try:
        client = _ssh_connect()
        sftp = client.open_sftp()

        # Read the file to get the title for MongoDB deletion
        try:
            with sftp.open(f"{PAIGE_PROCESSED}/{safe}", "r") as f:
                content = f.read().decode("utf-8", errors="replace")
            meta = _parse_frontmatter(content)
            title = meta["title"]
        except Exception:
            title = None

        # Remove the file from processed/
        sftp.remove(f"{PAIGE_PROCESSED}/{safe}")
        sftp.close()

        # Delete from MongoDB
        if title:
            cmd = f"python3 -c \"from pymongo import MongoClient; c = MongoClient(); c.coloring_store.blog_posts.delete_one({{'title': '{title.replace(chr(39), chr(92) + chr(39))}'}}); print('deleted')\""
            _, stdout, _ = client.exec_command(cmd, timeout=10)
            stdout.read()

        # Also remove from blog dir and rebuild
        blog_file = f"{PHYLLIS_BLOG_DIR}/{safe}"
        client.exec_command(f"rm -f '{blog_file}'", timeout=5)

        client.close()
        _paige_status_cache["data"] = None
        return {"success": True, "message": f"Deleted: {title or filename}"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"success": False, "error": "An internal error occurred"}


_system_cache = {"data": None, "timestamp": 0}
SYSTEM_CACHE_TTL = 5  # seconds


@app.get("/api/system")
def get_system_stats():
    now = time.time()
    if _system_cache["data"] and now - _system_cache["timestamp"] < SYSTEM_CACHE_TTL:
        return _system_cache["data"]

    try:
        c = _get_persistent_ssh()

        script = (
            'echo "=CPU="\n'
            "top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'\n"
            'echo "=RAM="\n'
            "free -m | awk 'NR==2{print $2, $3, $4}'\n"
            'echo "=DISK="\n'
            "df -h / | awk 'NR==2{print $2, $3, $4, $5}'\n"
            'echo "=GPU="\n'
            "/usr/lib/wsl/lib/nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo 'unavailable'\n"
            'echo "=PROCS="\n'
            "ps aux --sort=-%cpu | awk 'NR>1 && NR<=6{print $1, $3, $4, $11}'\n"
            'echo "=SVC="\n'
            'for s in phyllis-backend.service nginx.service earthlie-backend.service earthlie-frontend.service paige-webhook.service cloudflared.service ollama.service mongod.service ssh.service; do echo "$s=$(systemctl is-active $s 2>/dev/null || echo inactive)"; done\n'
            'echo "=SVCUSER="\n'
            "systemctl --user is-active openclaw-gateway.service 2>/dev/null || echo inactive\n"
        )

        _, stdout, _ = c.exec_command(script, timeout=15)
        output = stdout.read().decode("utf-8", errors="replace").strip()

        # Parse sections by markers
        sections = {}
        current_key = None
        current_lines = []
        for line in output.splitlines():
            if line.startswith("=") and line.endswith("=") and len(line) >= 3:
                if current_key:
                    sections[current_key] = "\n".join(current_lines)
                current_key = line.strip("=")
                current_lines = []
            else:
                current_lines.append(line)
        if current_key:
            sections[current_key] = "\n".join(current_lines)

        # Parse CPU
        cpu = sections.get("CPU", "0").strip()

        # Parse RAM
        ram_parts = sections.get("RAM", "0 0 0").strip().split()
        ram_total, ram_used, ram_free = (ram_parts + ["0", "0", "0"])[:3]

        # Parse Disk
        disk_parts = sections.get("DISK", "0 0 0 0%").strip().split()
        disk_total, disk_used, disk_free, disk_pct = (disk_parts + ["0", "0", "0", "0%"])[:4]

        # Parse GPU
        gpu_raw = sections.get("GPU", "unavailable").strip()
        if gpu_raw == "unavailable" or not gpu_raw:
            gpu = None
        else:
            gparts = [x.strip() for x in gpu_raw.split(",")]
            if len(gparts) >= 5:
                gpu = {"name": gparts[0], "utilization": gparts[1], "mem_used": gparts[2], "mem_total": gparts[3], "temperature": gparts[4]}
            else:
                gpu = None

        # Parse processes
        procs = []
        for line in sections.get("PROCS", "").splitlines():
            parts = line.split(None, 3)
            if len(parts) == 4:
                procs.append({"user": parts[0], "cpu": parts[1], "mem": parts[2], "cmd": parts[3]})

        # Parse services
        svc_status = {}
        for line in sections.get("SVC", "").splitlines():
            if "=" in line:
                svc, status = line.split("=", 1)
                svc_status[svc] = status.strip()
        svc_user_raw = sections.get("SVCUSER", "inactive").strip()
        svc_status["openclaw-gateway.service"] = svc_user_raw.splitlines()[0].strip() if svc_user_raw else "inactive"

        result = {
            "cpu_percent": cpu,
            "ram": {"total_mb": ram_total, "used_mb": ram_used, "free_mb": ram_free},
            "disk": {"total": disk_total, "used": disk_used, "free": disk_free, "percent": disk_pct},
            "gpu": gpu,
            "top_processes": procs,
            "services": svc_status,
        }
        _system_cache["data"] = result
        _system_cache["timestamp"] = now
        return result
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


@app.post("/api/system/clear-cache")
def clear_system_cache():
    _system_cache["data"] = None
    _system_cache["timestamp"] = 0
    return {"cleared": True}


@app.get("/api/ollama/models")
def get_ollama_models():
    try:
        c = _get_persistent_ssh()
        _, stdout, _ = c.exec_command("ollama list 2>/dev/null", timeout=15)
        output = stdout.read().decode().strip()
        models = []
        for line in output.splitlines()[1:]:  # skip header
            parts = line.split()
            if len(parts) >= 3:
                models.append({
                    "name": parts[0],
                    "id": parts[1],
                    "size": parts[2] + (" " + parts[3] if len(parts) > 3 else ""),
                })
        return {"models": models}
    except Exception as e:
        logger.error(f"Ollama models error: {e}")
        return {"error": "An internal error occurred"}


@app.post("/api/ollama/pull")
async def pull_ollama_model(body: dict):
    model = body.get("model", "").strip()
    if not model or ".." in model or "/" in model or "\\" in model:
        return {"error": "Invalid model name"}
    try:
        c = _ssh_connect()
        _, stdout, stderr = c.exec_command(f"ollama pull {model} 2>&1", timeout=300)
        out = stdout.read().decode().strip()
        c.close()
        success = "success" in out.lower() or "pulling" in out.lower() or "already" in out.lower()
        return {"success": success, "output": out[-500:] if len(out) > 500 else out}
    except Exception as e:
        logger.error(f"Ollama pull error: {e}")
        return {"error": "An internal error occurred"}


@app.delete("/api/ollama/models/{model_name:path}")
def delete_ollama_model(model_name: str):
    safe_name = model_name.strip()
    if not safe_name or ".." in safe_name or "/" in safe_name or "\\" in safe_name:
        return {"error": "Invalid model name"}
    try:
        c = _ssh_connect()
        _, stdout, stderr = c.exec_command(f"ollama rm {safe_name} 2>&1", timeout=30)
        out = stdout.read().decode().strip()
        c.close()
        success = "deleted" in out.lower() or out == ""
        return {"success": success, "output": out}
    except Exception as e:
        logger.error(f"Ollama delete error: {e}")
        return {"error": "An internal error occurred"}


ALLOWED_ACTIONS = {
    "restart_phyllis_backend": "echo one | sudo -S systemctl restart phyllis-backend.service 2>&1 && echo 'Done'",
    "restart_phyllis_frontend": "echo one | sudo -S systemctl reload nginx 2>&1 && echo 'Done'",
    "restart_earthlie_backend": "echo one | sudo -S systemctl restart earthlie-backend.service 2>&1 && echo 'Done'",
    "restart_earthlie_frontend": "echo one | sudo -S systemctl restart earthlie-frontend.service 2>&1 && echo 'Done'",
    "restart_paige_webhook": "echo one | sudo -S systemctl restart paige-webhook.service 2>&1 && echo 'Done'",
    "restart_openclaw": "systemctl --user restart openclaw-gateway.service && echo 'Done'",
    "restart_ollama": "echo one | sudo -S systemctl restart ollama.service 2>&1 && echo 'Done'",
    "restart_mongodb": "echo one | sudo -S systemctl restart mongod.service 2>&1 && echo 'Done'",
    "restart_cloudflared": "echo one | sudo -S systemctl restart cloudflared.service 2>&1 && echo 'Done'",
    "restart_openclaw_gateway": "systemctl --user restart openclaw-gateway.service && echo 'Done'",
    "check_disk": "df -h /",
    "clear_paige_staged": "rm -f /home/clarence/paige/staged/*.json && echo 'Staged cleared'",
    "git_pull_phyllis": "cd /home/clarence/PhyllisDiAnneStudio-App && git pull 2>&1",
    "check_gpu": "/usr/lib/wsl/lib/nvidia-smi 2>/dev/null || echo 'GPU unavailable'",
    "list_ollama_models": "ollama list 2>/dev/null || echo 'Ollama not running'",
}


@app.post("/api/system/action")
def run_system_action(body: dict):
    action = body.get("action")
    if action not in ALLOWED_ACTIONS:
        return {"error": "Action not allowed"}
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(CLAWBOT_HOST, port=CLAWBOT_PORT, username=CLAWBOT_USER, password=CLAWBOT_PASSWORD)
        _, stdout, stderr = c.exec_command(ALLOWED_ACTIONS[action])
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        c.close()
        return {"output": out or err or "Done"}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


@app.post("/api/paige/seo-preview")
async def seo_preview(body: dict):
    import anthropic

    content = body.get("content", "")
    title = body.get("title", "")
    if not content:
        return {"error": "No content provided"}
    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this blog post for SEO quality. Be concise and specific.

Title: {title}

Content:
{content}

Return a JSON object with exactly this structure:
{{
  "score": <number 0-100>,
  "grade": "<A/B/C/D/F>",
  "summary": "<one sentence overall assessment>",
  "checks": [
    {{"label": "<check name>", "passed": <true/false>, "note": "<specific feedback>"}}
  ]
}}

Check these specific things:
1. Title length (50-60 chars is ideal)
2. Word count (700+ words is good)
3. Has H2/H3 headings
4. Has a clear call to action
5. Keyword not stuffed (natural repetition)
6. Readable tone (warm, not robotic)
7. Has specific/concrete details (not vague)
8. Opening hook (first sentence grabs attention)

Return only valid JSON, no markdown, no explanation.""",
                }
            ],
        )
        text = message.content[0].text.strip()
        result = json.loads(text)
        return result
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"error": "An internal error occurred"}


# ---------------------------------------------------------------------------
# Earthlie Services
# ---------------------------------------------------------------------------

EARTHLIE_SERVICES = ["EarthlieBackend", "EarthlieFrontend", "MongoDB"]


@app.get("/api/earthlie/services/status")
def earthlie_services_status():
    """Get status of all Earthlie services."""
    results = {}
    for svc in EARTHLIE_SERVICES:
        try:
            out = subprocess.run(
                ["powershell", "-Command", f"(Get-Service '{svc}').Status"],
                capture_output=True, text=True, timeout=10
            )
            status_text = out.stdout.strip()
            results[svc] = status_text if status_text else "Unknown"
        except Exception as e:
            results[svc] = "Unknown"
    return {"services": results}


@app.post("/api/earthlie/services/{service_name}/{action}")
def earthlie_service_action(service_name: str, action: str):
    """Start, stop, or restart an Earthlie service."""
    if service_name not in EARTHLIE_SERVICES:
        return {"success": False, "error": f"Unknown service: {service_name}"}
    if action not in ("start", "stop", "restart"):
        return {"success": False, "error": f"Unknown action: {action}"}

    try:
        if action == "restart":
            result = subprocess.run(
                ["powershell", "-Command",
                 f"Start-Process -FilePath 'C:\\tools\\nssm\\nssm.exe' -ArgumentList 'restart','{service_name}' -Verb RunAs -Wait"],
                capture_output=True, text=True, timeout=30
            )
        elif action == "stop":
            result = subprocess.run(
                ["powershell", "-Command",
                 f"Start-Process -FilePath 'net' -ArgumentList 'stop','{service_name}' -Verb RunAs -Wait"],
                capture_output=True, text=True, timeout=30
            )
        else:  # start
            result = subprocess.run(
                ["powershell", "-Command",
                 f"Start-Process -FilePath 'net' -ArgumentList 'start','{service_name}' -Verb RunAs -Wait"],
                capture_output=True, text=True, timeout=30
            )

        return {"success": True, "output": result.stdout.strip(), "error": result.stderr.strip() if result.returncode != 0 else ""}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Operation timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Earthlie Blog proxy — forwards to earthlie backend on CLAWBOT via SSH
# ---------------------------------------------------------------------------

EARTHLIE_API = "http://localhost:8003"
EARTHLIE_INTERNAL_TOKEN = os.environ.get("EARTHLIE_INTERNAL_TOKEN", "")


def _earthlie_request(method: str, path: str, body: str = "", timeout: int = 180):
    """Execute an HTTP request to the earthlie backend via SSH."""
    ssh = _get_persistent_ssh()
    token_header = f"-H 'x-internal-token: {EARTHLIE_INTERNAL_TOKEN}'" if EARTHLIE_INTERNAL_TOKEN and "/api/internal/" in path else ""
    if body:
        # Write body to temp file to avoid shell quoting issues
        sftp = ssh.open_sftp()
        with sftp.open("/tmp/_earthlie_req.json", "w") as f:
            f.write(body)
        sftp.close()
        cmd = f"curl -s --max-time {timeout} -X {method} -H 'Content-Type: application/json' {token_header} -d @/tmp/_earthlie_req.json '{EARTHLIE_API}{path}'"
    else:
        cmd = f"curl -s --max-time {timeout} -X {method} {token_header} '{EARTHLIE_API}{path}'"
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout + 10)
    return stdout.read().decode()


@app.get("/api/earthlie/{path:path}")
async def earthlie_proxy_get(path: str):
    import json as _json
    raw = _earthlie_request("GET", f"/{path}")
    try:
        return _json.loads(raw)
    except Exception:
        return PlainTextResponse(raw)


@app.put("/api/earthlie/{path:path}")
async def earthlie_proxy_put(path: str, request: Request):
    import json as _json
    import asyncio
    try:
        req_body = await request.json()
        body_str = _json.dumps(req_body)
    except Exception:
        body_str = ""
    raw = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _earthlie_request("PUT", f"/{path}", body_str)
    )
    try:
        return _json.loads(raw)
    except Exception:
        return PlainTextResponse(raw)


@app.post("/api/earthlie/{path:path}")
async def earthlie_proxy_post(path: str, request: Request):
    import json as _json
    import asyncio
    try:
        req_body = await request.json()
        body_str = _json.dumps(req_body)
    except Exception:
        body_str = ""
    raw = await asyncio.get_event_loop().run_in_executor(
        None, lambda: _earthlie_request("POST", f"/{path}", body_str)
    )
    try:
        return _json.loads(raw)
    except Exception:
        return PlainTextResponse(raw)


@app.delete("/api/earthlie/{path:path}")
async def earthlie_proxy_delete(path: str):
    import json as _json
    raw = _earthlie_request("DELETE", f"/{path}")
    try:
        return _json.loads(raw)
    except Exception:
        return PlainTextResponse(raw)


# ---------------------------------------------------------------------------
# Cloudflare Analytics
# ---------------------------------------------------------------------------

CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CLOUDFLARE_ZONES = {
    "earthliedesigns.com": "8535e0abec53c9c4e1642fc80e265cab",
    "phyllisdiannestudio.com": "915da1886a6078c28072f8e29ae15fc1",
}

CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql"

def _cf_query(zone_id: str, date_start: str, date_end: str) -> dict:
    """Query Cloudflare GraphQL for a single zone's 7-day analytics."""
    import httpx

    query = """
    {
      viewer {
        zones(filter: {zoneTag: "%s"}) {
          httpRequests1dGroups(
            limit: 7
            filter: {date_geq: "%s", date_leq: "%s"}
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum {
              requests
              pageViews
              countryMap { clientCountryName requests }
            }
            uniq { uniques }
          }
        }
      }
    }
    """ % (zone_id, date_start, date_end)

    resp = httpx.post(
        CLOUDFLARE_GRAPHQL_URL,
        json={"query": query},
        headers={
            "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    return resp.json()


@app.get("/api/analytics")
def get_analytics():
    if not CLOUDFLARE_API_TOKEN:
        return {"error": "CLOUDFLARE_API_TOKEN not configured"}

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    week_ago = (datetime.now(timezone.utc) - timedelta(days=6)).strftime("%Y-%m-%d")

    results = {}
    for domain, zone_id in CLOUDFLARE_ZONES.items():
        try:
            raw = _cf_query(zone_id, week_ago, today)
            zones = raw.get("data", {}).get("viewer", {}).get("zones", [])
            if not zones:
                results[domain] = {"error": "No data returned", "days": []}
                continue

            groups = zones[0].get("httpRequests1dGroups", [])

            days = []
            total_requests = 0
            total_pageviews = 0
            total_uniques = 0
            country_totals = {}

            for g in groups:
                date = g["dimensions"]["date"]
                reqs = g["sum"]["requests"]
                pvs = g["sum"]["pageViews"]
                uniq = g["uniq"]["uniques"]
                total_requests += reqs
                total_pageviews += pvs
                total_uniques += uniq

                for c in g["sum"].get("countryMap", []):
                    cc = c["clientCountryName"]
                    country_totals[cc] = country_totals.get(cc, 0) + c["requests"]

                days.append({
                    "date": date,
                    "requests": reqs,
                    "pageViews": pvs,
                    "uniques": uniq,
                })

            # Top 10 countries by request count
            top_countries = sorted(country_totals.items(), key=lambda x: x[1], reverse=True)[:10]

            results[domain] = {
                "days": days,
                "totals": {
                    "requests": total_requests,
                    "pageViews": total_pageviews,
                    "uniques": total_uniques,
                },
                "topCountries": [{"country": c, "requests": r} for c, r in top_countries],
            }
        except Exception as e:
            logger.error(f"Cloudflare analytics error for {domain}: {e}")
            results[domain] = {"error": str(e), "days": []}

    return results


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
