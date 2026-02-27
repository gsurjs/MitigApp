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

@app.get("/")
def read_root():
    return {"status": "API is live and armed."}

@app.get("/api/mitigations")
def get_mitigations():
    """Fetches all mitigations to populate the front-end checkboxes."""
    response = supabase.table("mitigations").select("*").execute()
    return response.data

# Define the Expected Incoming Data Model
class MitigationRequest(BaseModel):
    mitigated_ids: List[str]

# The Core Analysis Endpoint
@app.post("/api/analyze")
def analyze_risk(request: MitigationRequest):
    """
    Takes an array of active mitigation IDs and returns the 
    threat groups that are still capable of breaching the network.
    """
    # Step A: Find all techniques blocked by the currently checked mitigations
    if not request.mitigated_ids:
        blocked_technique_ids = set()
    else:
        # Get the techniques blocked by the provided mitigations
        blocked_techs_response = supabase.table("mitigation_blocks_technique") \
            .select("technique_id") \
            .in_("mitigation_id", request.mitigated_ids) \
            .execute()
        
        # Convert to a Python set for lookups
        blocked_technique_ids = {row["technique_id"] for row in blocked_techs_response.data}

    # Step B: Pull all known threat actor techniques
    all_group_techs = supabase.table("group_uses_technique").select("*").execute()

    # Step C: Cross-reference to find exposed groups
    exposed_group_ids = set()
    for row in all_group_techs.data:
        if row["technique_id"] not in blocked_technique_ids:
            exposed_group_ids.add(row["group_id"])

    # Step D: Fetch the human-readable details for the exposed actors
    if not exposed_group_ids:
        return {"status": "secure", "message": "No known threat actors are currently bypassing your defenses.", "exposed_actors": []}
        
    actors_response = supabase.table("threat_groups") \
        .select("name, mitre_id, aliases, description") \
        .in_("id", list(exposed_group_ids)) \
        .execute()

    return {
        "status": "vulnerable",
        "total_exposed_actors": len(actors_response.data),
        "exposed_actors": actors_response.data
    }


# middleware for CORS to allow our React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # React app's address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)