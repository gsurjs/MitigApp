import os
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from stix2 import MemoryStore
import stix2

# Load the variables from the .env file into the environment
load_dotenv()

# 1. Initialize Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# 2. Fetch the MITRE Enterprise ATT&CK Dataset
print("Fetching MITRE STIX data...")
MITRE_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
response = requests.get(MITRE_URL)
stix_json = response.json()

# Load into stix2 MemoryStore for easy querying
mem_store = MemoryStore(stix_data=stix_json["objects"])

# 3. Extract and Insert Mitigations
print("Parsing Mitigations...")
mitigations = mem_store.query([
    stix2.Filter("type", "=", "course-of-action")
])

for mit in mitigations:
    # Extract the public MITRE ID (e.g., M1031)
    mitre_id = next((ext["external_id"] for ext in mit.get("external_references", []) if ext["source_name"] == "mitre-attack"), None)
    
    if mitre_id:
        data = {
            "id": mit["id"],
            "mitre_id": mitre_id,
            "name": mit["name"],
            "description": mit.get("description", "")
        }
        # Insert into Supabase
        supabase.table("mitigations").upsert(data).execute()

print("Mitigations loaded successfully.")

# 4. Extract and Insert Techniques
print("Parsing Techniques...")
techniques = mem_store.query([
    stix2.Filter("type", "=", "attack-pattern")
])

for tech in techniques:
    mitre_id = next((ext["external_id"] for ext in tech.get("external_references", []) if ext["source_name"] == "mitre-attack"), None)
    
    if mitre_id:
        # Extract tactics (e.g., Initial Access)
        tactics = [phase["phase_name"] for phase in tech.get("kill_chain_phases", [])]
        
        data = {
            "id": tech["id"],
            "mitre_id": mitre_id,
            "name": tech["name"],
            "description": tech.get("description", ""),
            "tactics": tactics
        }
        supabase.table("techniques").upsert(data).execute()

print("Techniques loaded successfully.")

# 5. Extract and Insert Threat Groups (Intrusion Sets)
print("Parsing Threat Groups...")
groups = mem_store.query([
    stix2.Filter("type", "=", "intrusion-set")
])

for group in groups:
    mitre_id = next((ext["external_id"] for ext in group.get("external_references", []) if ext["source_name"] == "mitre-attack"), None)
    
    if mitre_id:
        data = {
            "id": group["id"],
            "mitre_id": mitre_id,
            "name": group["name"],
            "description": group.get("description", ""),
            "aliases": group.get("aliases", []) # JSONB array
        }
        supabase.table("threat_groups").upsert(data).execute()

print("Threat Groups loaded successfully.")

# 6. Extract and Insert Relationships (The Engine)
print("Parsing Relationships (This might take a minute)...")
relationships = mem_store.query([
    stix2.Filter("type", "=", "relationship")
])

for rel in relationships:
    source = rel.get("source_ref")
    target = rel.get("target_ref")
    rel_type = rel.get("relationship_type")

    # Map: Mitigation blocks Technique
    if source.startswith("course-of-action--") and target.startswith("attack-pattern--") and rel_type == "mitigates":
        data = {"mitigation_id": source, "technique_id": target}
        try:
            supabase.table("mitigation_blocks_technique").upsert(data).execute()
        except Exception:
            # MITRE sometimes leaves orphaned relationships for deprecated techniques. 
            # We catch the exception so it doesn't crash our script on a Foreign Key violation.
            pass

    # Map: Threat Group uses Technique
    elif source.startswith("intrusion-set--") and target.startswith("attack-pattern--") and rel_type == "uses":
        data = {"group_id": source, "technique_id": target}
        try:
            supabase.table("group_uses_technique").upsert(data).execute()
        except Exception:
            pass

print("All Relationships mapped! Database is fully armed.")