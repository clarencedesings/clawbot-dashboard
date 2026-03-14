from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from datetime import datetime, timezone
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


@app.get("/api/openclaw/config")
async def openclaw_config():
    config = ssh_read_openclaw_config()
    if config is None:
        return {"error": "Could not read OpenClaw config via SSH"}
    return config


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
