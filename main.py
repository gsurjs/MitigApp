import os
from fastapi import FastAPI
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel
from typing import List
from fastapi.middleware.cors import CORSMiddleware

# Load the variables from the .env file
load_dotenv()

# Initialize the FastAPI App
app = FastAPI(title="Threat API", description="Backend for the Risk Translation Engine")

# Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY") 
supabase: Client = create_client(url, key)

def fetch_entire_table(table_name: str, columns: str = "*"):
    """Fetches all rows from a table by paginating through the 1000-row limit."""
    all_rows = []
    start = 0
    step = 1000
    
    while True:
        response = supabase.table(table_name).select(columns).range(start, start + step - 1).execute()
        data = response.data
        all_rows.extend(data)
        
        # If we got fewer than 1000 rows back, we've reached the end of the table
        if len(data) < step:
            break
            
        start += step
        
    return all_rows

@app.get("/")
def read_root():
    return {"status": "API is live and armed."}

@app.get("/api/mitigations")
def get_mitigations():
    """Fetches all mitigations to populate the front-end checkboxes."""
    # UPDATED: Now uses the paginator
    return fetch_entire_table("mitigations")

# Define the Expected Incoming Data Model
class MitigationRequest(BaseModel):
    mitigated_ids: List[str]

class LogPayload(BaseModel):
    source: str
    log_message: str

# The Core Analysis Endpoint
@app.post("/api/analyze")
def analyze_risk(request: MitigationRequest):
    """
    Takes an array of active mitigation IDs, returns exposed threat groups,
    and calculates the highest ROI mitigations to implement next.
    """
    # Step A: Find all techniques blocked by the currently checked mitigations
    if not request.mitigated_ids:
        blocked_technique_ids = set()
    else:
        blocked_techs_response = supabase.table("mitigation_blocks_technique") \
            .select("technique_id") \
            .in_("mitigation_id", request.mitigated_ids) \
            .limit(10000) \
            .execute()
        blocked_technique_ids = {row["technique_id"] for row in blocked_techs_response.data}

    # Step B: Pull all known threat actor techniques
    # Now uses the paginator to bypass the 1000 row cap
    all_group_techs = fetch_entire_table("group_uses_technique")

    # Step C: Cross-reference and Calculate Vector Coverage
    group_stats = {} 
    exposed_technique_ids = set()
    
    for row in all_group_techs:
        g_id = row["group_id"]
        t_id = row["technique_id"]
        
        if g_id not in group_stats:
            group_stats[g_id] = {"total": 0, "exposed": 0, "exposed_tech_list": []}
            
        group_stats[g_id]["total"] += 1
        
        if t_id not in blocked_technique_ids:
            group_stats[g_id]["exposed"] += 1
            group_stats[g_id]["exposed_tech_list"].append(t_id)
            exposed_technique_ids.add(t_id)

    # Only keep groups that have at least 1 exposed technique
    exposed_group_ids = [g_id for g_id, stats in group_stats.items() if stats["exposed"] > 0]

    # Step D: Calculate ROI for Unchecked Mitigations
    # Both now use the paginator
    all_blocks = fetch_entire_table("mitigation_blocks_technique")
    all_mitigations = fetch_entire_table("mitigations")
    
    recommendations = []
    unchecked_mitigations = [m for m in all_mitigations if m["id"] not in request.mitigated_ids]
    
    for mit in unchecked_mitigations:
        blocks = {b["technique_id"] for b in all_blocks if b["mitigation_id"] == mit["id"]}
        impact = len(blocks.intersection(exposed_technique_ids))
        
        if impact > 0:
            recommendations.append({
                "id": mit["id"],
                "mitre_id": mit["mitre_id"],
                "name": mit["name"],
                "impact_score": impact
            })

    # Sort to find the highest impact mitigations
    recommendations.sort(key=lambda x: x["impact_score"], reverse=True)
    top_recommendations = recommendations[:3] 

    # Step E: Fetch human-readable details and inject the new stats
    if not exposed_group_ids:
        return {"status": "secure", "total_exposed_actors": 0, "exposed_actors": [], "recommendations": []}
        
    actors_response = supabase.table("threat_groups") \
        .select("id, name, mitre_id, aliases, description") \
        .in_("id", list(exposed_group_ids)) \
        .limit(10000) \
        .execute()
    
    # UPDATED: Now uses the paginator
    all_techniques = fetch_entire_table("techniques", "id, name, mitre_id")
    tech_map = {t["id"]: {"name": t["name"], "mitre_id": t["mitre_id"]} for t in all_techniques}

    # Map the vector math into the final payload
    for actor in actors_response.data:
        stats = group_stats[actor["id"]]
        actor["total_vectors"] = stats["total"]
        actor["exposed_vectors"] = stats["exposed"]
        actor["mitigation_percent"] = int(((stats["total"] - stats["exposed"]) / stats["total"]) * 100)

        # Build the exact list of exposed techniques for the front end
        exposed_tech_details = []
        for t_id in stats["exposed_tech_list"]:
            if t_id in tech_map:
                exposed_tech_details.append(tech_map[t_id])
        actor["exposed_techniques"] = exposed_tech_details

    # Sort actors so the most "Protected" ones appear first
    actors_response.data.sort(key=lambda x: x["mitigation_percent"], reverse=True)

    return {
        "status": "vulnerable",
        "total_exposed_actors": len(actors_response.data),
        "exposed_actors": actors_response.data,
        "recommendations": top_recommendations
    }

@app.get("/api/emerging-vectors")
def get_emerging_vectors():
    """Fetches the 50 newest attack vectors and their associated threat group descriptions."""
    
    # 1. Grab the 50 newest techniques
    response = supabase.table("techniques").select("id, name, mitre_id, mitre_created, description").order("mitre_created", desc=True).limit(50).execute()
    newest_techs = response.data

    if not newest_techs:
        return []

    tech_ids = [t["id"] for t in newest_techs]

    # 2. Find which threat groups use these specific techniques
    uses_response = supabase.table("group_uses_technique").select("group_id, technique_id").in_("technique_id", tech_ids).limit(10000).execute()
    group_ids = list(set([row["group_id"] for row in uses_response.data]))

    # 3. Get the descriptions of those threat groups
    group_desc_map = {}
    if group_ids:
        groups_response = supabase.table("threat_groups").select("id, description").in_("id", group_ids).limit(1000).execute()
        group_desc_map = {g["id"]: g["description"] for g in groups_response.data}

    # 4. Map the descriptions back to the vectors
    results = []
    for tech in newest_techs:
        associated_group_ids = [u["group_id"] for u in uses_response.data if u["technique_id"] == tech["id"]]
        descriptions = [group_desc_map[g_id] for g_id in associated_group_ids if g_id in group_desc_map]
        
        results.append({
            "mitre_id": tech["mitre_id"],
            "name": tech["name"],
            "description": tech.get("description", ""), # Techniques table has a description field, but it may be empty
            "created": tech["mitre_created"],
            "associated_descriptions": descriptions
        })

    return results

# --- TELEMETRY & REASONING ENGINE ---

# Dictionary mapping MITRE IDs to lists of detection keywords/regex strings
DETECTION_RULES = {
    "T1498": ["rate limit exceeded", "req/sec >", "ddos", "traffic spike", "flood"], # Network Denial of Service
    "T1566": ["malicious attachment", "phishing", "suspicious email", "macro detected"], # Phishing
    "T1190": ["sql injection", "1=1", "union select", "path traversal", "../", "xss"], # Exploit Public-Facing App
    "T1059": ["suspicious powershell", "bypass execution policy", "hidden window", "cmd.exe /c"], # Command/Scripting Interpreter
    "T1078": ["failed login", "brute force", "invalid credentials", "multiple login attempts"], # Valid Accounts
    "T1003": ["lsass", "mimikatz", "credential dumping", "memory dump"], # OS Credential Dumping
    "T1486": ["ransomware", "encrypt", "shadow copies deleted", "vssadmin delete shadows"], # Data Encrypted for Impact
    "T1105": ["wget", "curl", "invoke-webrequest", "download payload"], # Ingress Tool Transfer
    "T1046": ["port scan", "nmap", "sweeping", "discovery scan"], # Network Service Discovery
    "T1543": ["new service created", "systemd modified", "init script altered"] # Create or Modify System Process
}

# --- SCALABLE REASONING ENGINE ---

# 1. Global Cache to hold all 600+ MITRE Techniques in memory
mitre_technique_cache = []

def get_all_mitre_techniques():
    """Loads all techniques from the DB once, preventing API spam on high log volume."""
    global mitre_technique_cache
    if not mitre_technique_cache:
        # Uses your existing paginator to safely grab the entire MITRE catalog!
        mitre_technique_cache = fetch_entire_table("techniques", "id, mitre_id, name")
    return mitre_technique_cache

# 2. Slang Dictionary: Translates IT shorthand into official MITRE IDs
SLANG_OVERRIDES = {
    "ddos": "T1498",
    "sql injection": "T1190",
    "phishing": "T1566",
    "ransomware": "T1486",
    "mimikatz": "T1003",
    "brute force": "T1078"
}

@app.post("/api/telemetry/ingest")
def ingest_log(payload: LogPayload):
    """
    Receives logs and maps them dynamically using the entire MITRE database.
    """
    log_lower = payload.log_message.lower()
    detected_tech = None

    # Step A: Check for common IT Slang / Acronyms first
    for slang, mitre_id in SLANG_OVERRIDES.items():
        if slang in log_lower:
            detected_tech = next((t for t in get_all_mitre_techniques() if t["mitre_id"] == mitre_id), None)
            break

    # Step B: Full Framework Scan (Checks against all 600+ official MITRE names)
    if not detected_tech:
        for tech in get_all_mitre_techniques():
            # e.g., if the log contains the exact phrase "Valid Accounts" or "Spearphishing"
            if tech["name"].lower() in log_lower:
                detected_tech = tech
                break
            
    if detected_tech:
        # Save the active hit directly using the cached UUID
        supabase.table("telemetry_events").insert({
            "source": payload.source,
            "mitre_id": detected_tech["mitre_id"],
            "technique_id": detected_tech["id"],
            "raw_log": payload.log_message
        }).execute()
        
        return {"status": "Threat detected and mapped", "mitre_id": detected_tech["mitre_id"]}
            
    return {"status": "Log ingested, no known threats detected"}

@app.get("/api/telemetry/active")
def get_active_telemetry():
    """Fetches recent telemetry events from Supabase."""
    response = supabase.table("telemetry_events").select("*").order("timestamp", desc=True).limit(50).execute()
    return response.data

@app.post("/api/telemetry/clear")
def clear_telemetry():
    """Clears the telemetry table to reset the executive demo."""
    # Deletes all rows where mitre_id is not empty
    supabase.table("telemetry_events").delete().neq("mitre_id", "0").execute()
    return {"status": "cleared"}

# middleware for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)