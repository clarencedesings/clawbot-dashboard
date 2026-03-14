from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import json
import os
import socket
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

# Cache for SSH config reads
_config_cache = {"data": None, "timestamp": 0}
CACHE_TTL = 30  # seconds

MOCK_BOTS = [
    {
        "id": "jarvis",
        "name": "Jarvis",
        "role": "main",
        "status": "online",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
    {
        "id": "business",
        "name": "Business",
        "role": "business",
        "status": "online",
        "model": "llama3.1:8b",
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    },
    {
        "id": "research",
        "name": "Research",
        "role": "research",
        "status": "idle",
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


def ssh_read_openclaw_config() -> dict | None:
    """Read openclaw.json from Clawbot via SSH, cached for 30 seconds."""
    now = time.time()
    if _config_cache["data"] is not None and (now - _config_cache["timestamp"]) < CACHE_TTL:
        return _config_cache["data"]

    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=CLAWBOT_HOST,
            port=CLAWBOT_PORT,
            username=CLAWBOT_USER,
            password=CLAWBOT_PASSWORD,
            timeout=5,
        )
        _, stdout, _ = client.exec_command(f"cat {OPENCLAW_CONFIG_PATH}")
        raw = stdout.read().decode("utf-8")
        client.close()

        config = json.loads(raw)
        _config_cache["data"] = config
        _config_cache["timestamp"] = now
        return config
    except Exception:
        return _config_cache["data"]  # return stale cache if available


def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a port is listening by attempting a socket connection."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, ConnectionRefusedError, TimeoutError):
        return False


def bots_from_config(config: dict) -> list[dict]:
    """Parse openclaw.json into bot list."""
    gateway_online = check_port(CLAWBOT_HOST, 18789, timeout=2)
    status = "online" if gateway_online else "offline"

    bots = []

    # Main agent (Jarvis) — uses agents.defaults.model.primary
    defaults = config.get("agents", {}).get("defaults", {})
    default_model = defaults.get("model", {})
    if isinstance(default_model, dict):
        default_model = default_model.get("primary", "unknown")
    if not isinstance(default_model, str):
        default_model = "unknown"
    bots.append({
        "id": "jarvis",
        "name": "Jarvis",
        "role": "main",
        "status": status,
        "model": default_model,
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    })

    # Sub-agents — business, research, coder
    sub_agents = config.get("agents", {}).get("agents", [])
    for agent in sub_agents:
        agent_id = agent.get("id", agent.get("name", "unknown")).lower().replace(" ", "-")
        identity = agent.get("identity", {})
        name = identity.get("name", agent.get("name", agent_id.capitalize()))
        model = agent.get("model", default_model)
        if isinstance(model, dict):
            model = model.get("primary", default_model)
        bots.append({
            "id": agent_id,
            "name": name,
            "role": agent_id,
            "status": status,
            "model": model,
            "uptime": "—",
            "requests_today": 0,
            "last_active": "—",
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
    port = 18789
    online = check_port(CLAWBOT_HOST, port)
    return {
        "online": online,
        "port": port,
        "gateway": gateway_url,
    }


@app.get("/api/dashboard/summary")
async def dashboard_summary():
    config = ssh_read_openclaw_config()
    if config:
        bots = bots_from_config(config)
        gateway_online = check_port(CLAWBOT_HOST, 18789, timeout=2)
    else:
        bots = MOCK_BOTS
        gateway_online = False

    online_count = sum(1 for b in bots if b["status"] == "online")
    return {
        "total_bots": len(bots),
        "online_bots": online_count,
        "gateway_online": gateway_online,
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
