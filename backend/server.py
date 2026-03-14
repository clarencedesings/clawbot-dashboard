import hashlib
import re
from pathlib import Path
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import json
import os
import time
import paramiko

load_dotenv()

app = FastAPI(title="Clawbot Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSH config for Clawbot
CLAWBOT_HOST = "192.168.0.130"
CLAWBOT_PORT = 2222
CLAWBOT_USER = "clarence"
CLAWBOT_PASSWORD = os.getenv("CLAWBOT_PASSWORD", "")
OPENCLAW_CONFIG_PATH = "/home/clarence/.openclaw/openclaw.json"

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
DISMISSED_ALERTS_FILE = Path(__file__).parent / "dismissed_alerts.json"

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

        # Last active: read last line of most recent openclaw log
        _, stdout_log, _ = client.exec_command(
            "ls -t /tmp/openclaw/openclaw-*.log 2>/dev/null | head -1 | xargs -r tail -1"
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


@app.get("/api/bots")
async def get_bots():
    config = ssh_read_openclaw_config()
    if config:
        bots = bots_from_config(config)
    else:
        bots = MOCK_BOTS
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
    return {
        "total_bots": len(bots),
        "online_bots": online_count,
        "gateway_online": services["gateway"],
        "model": model,
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
            "ls -t /tmp/openclaw/openclaw-*.log 2>/dev/null | head -1 | xargs -r tail -200"
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
            "ls -t /tmp/openclaw/openclaw-*.log 2>/dev/null | head -1 | xargs -r cat"
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
_MODEL_PATTERN = re.compile(r"model=([\w.:\-/]+)")


def ssh_read_token_usage() -> dict:
    """Read log lines and extract token/usage data, cached 30s."""
    now_time = time.time()
    if _tokens_cache["data"] is not None and (now_time - _tokens_cache["timestamp"]) < TOKENS_CACHE_TTL:
        return _tokens_cache["data"]

    try:
        client = _ssh_connect()
        # Read ALL log files
        _, stdout, _ = client.exec_command(
            "cat /tmp/openclaw/openclaw-*.log 2>/dev/null"
        )
        raw = stdout.read().decode("utf-8", errors="replace")
        client.close()
    except Exception:
        return _tokens_cache["data"] or _empty_token_data()

    requests_total = 0
    errors_total = 0
    success_durations = []
    hourly = {}  # hour_key -> count
    recent_runs = []

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

        # Count embedded run starts as requests
        is_run_start = "embedded run" in msg_lower and ("registered" in msg_lower or "start" in msg_lower)
        is_run_done = "embedded run" in msg_lower and "done" in msg_lower

        if not is_run_start and not is_run_done and "provider=anthropic" not in msg_lower:
            continue

        dt = _parse_log_timestamp_dt(raw_ts)
        is_error = "iserror=true" in msg_lower and "iserror=false" not in msg_lower

        if is_run_start or "provider=anthropic" in msg_lower:
            requests_total += 1
            if dt:
                hour_key = dt.strftime("%Y-%m-%d %H:00")
                hourly[hour_key] = hourly.get(hour_key, 0) + 1

        # Extract duration from done messages — only successful runs for avg
        dur_match = _DURATION_PATTERN.search(message)
        duration_ms = int(dur_match.group(1)) if dur_match else None

        if is_run_done and duration_ms is not None and not is_error:
            success_durations.append(duration_ms)

        if is_error:
            errors_total += 1

        # Collect recent run events for activity table
        if is_run_start or is_run_done:
            model_match = _MODEL_PATTERN.search(message)
            model = model_match.group(1) if model_match else "—"
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
    estimated_cost = round(requests_total * 0.003, 3)

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
        "balance_remaining": 5.00,
        "hourly_breakdown": hourly_breakdown,
        "recent_activity": recent_activity,
    }

    _tokens_cache["data"] = result
    _tokens_cache["timestamp"] = now_time
    return result


def _empty_token_data() -> dict:
    return {
        "requests_today": 0,
        "requests_total": 0,
        "avg_response_ms": 0,
        "errors_today": 0,
        "estimated_cost": 0,
        "balance_remaining": 5.00,
        "hourly_breakdown": [],
        "recent_activity": [],
    }


@app.get("/api/tokens")
async def get_tokens():
    return ssh_read_token_usage()


@app.get("/api/openclaw/config")
async def openclaw_config():
    config = ssh_read_openclaw_config()
    if config is None:
        return {"error": "Could not read OpenClaw config via SSH"}
    return config


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
