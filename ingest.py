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