from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
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
_status_cache = {"gateway": False, "ollama": False, "timestamp": 0}
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
    """Check gateway port 18789 and ollama status on Clawbot via SSH, cached."""
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

        client.close()

        _status_cache["gateway"] = gateway_online
        _status_cache["ollama"] = ollama_online
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

    # Main agent (Jarvis) — status based on gateway
    bots.append({
        "id": "jarvis",
        "name": "Jarvis",
        "role": "main",
        "status": "online" if gateway_online else "offline",
        "model": default_model,
        "uptime": "—",
        "requests_today": 0,
        "last_active": "—",
    })

    # Sub-agents from agents.list
    agent_list = agents_config.get("list", [])
    for agent in agent_list:
        agent_id = agent.get("id", agent.get("name", "unknown")).lower().replace(" ", "-")
        name = agent_id.capitalize()
        model = _resolve_model(agent.get("model", default_model), default_model)
        bots.append({
            "id": agent_id,
            "name": name,
            "role": agent_id,
            "status": "online" if ollama_online else "offline",
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
    else:
        bots = MOCK_BOTS

    online_count = sum(1 for b in bots if b["status"] == "online")
    services = ssh_check_services()
    return {
        "total_bots": len(bots),
        "online_bots": online_count,
        "gateway_online": services["gateway"],
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
