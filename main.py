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

# middleware for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)