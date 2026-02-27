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

# Helper function to insert data in massive chunks of 1000
def batch_upsert(table_name, data_list, batch_size=1000):
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i + batch_size]
        supabase.table(table_name).upsert(batch).execute()

# 2. Fetch the MITRE Enterprise ATT&CK Dataset
print("Fetching MITRE STIX data...")
MITRE_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
response = requests.get(MITRE_URL)
stix_json = response.json()

# Load into stix2 MemoryStore for easy querying
mem_store = MemoryStore(stix_data=stix_json["objects"])

# Sets to hold valid IDs to prevent Foreign Key errors later
valid_mitigations = set()
valid_techniques = set()
valid_groups = set()

# 3. Extract and Insert Mitigations
print("Parsing Mitigations...")
mitigations = mem_store.query([stix2.Filter("type", "=", "course-of-action")])
mit_data = []

for mit in mitigations:
    mitre_id = next((ext["external_id"] for ext in mit.get("external_references", []) if ext["source_name"] == "mitre-attack"), None)
    if mitre_id:
        mit_data.append({
            "id": mit["id"],
            "mitre_id": mitre_id,
            "name": mit["name"],
            "description": mit.get("description", "")
        })
        valid_mitigations.add(mit["id"])

batch_upsert("mitigations", mit_data)
print(f"Successfully batch uploaded {len(mit_data)} Mitigations.")

# 4. Extract and Insert Techniques
print("Parsing Techniques...")
techniques = mem_store.query([stix2.Filter("type", "=", "attack-pattern")])
tech_data = []

for tech in techniques:
    mitre_id = next((ext["external_id"] for ext in tech.get("external_references", []) if ext["source_name"] == "mitre-attack"), None)
    if mitre_id:
        tactics = [phase["phase_name"] for phase in tech.get("kill_chain_phases", [])]
        tech_data.append({
            "id": tech["id"],
            "mitre_id": mitre_id,
            "name": tech["name"],
            "description": tech.get("description", ""),
            "tactics": tactics
        })
        valid_techniques.add(tech["id"])

batch_upsert("techniques", tech_data)
print(f"Successfully batch uploaded {len(tech_data)} Techniques.")

# 5. Extract and Insert Threat Groups
print("Parsing Threat Groups...")
groups = mem_store.query([stix2.Filter("type", "=", "intrusion-set")])
group_data = []

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
        valid_groups.add(group["id"])

batch_upsert("threat_groups", group_data)
print(f"Successfully batch uploaded {len(group_data)} Threat Groups.")

# 6. Extract and Insert Relationships (The Engine)
print("Parsing Relationships...")
relationships = mem_store.query([stix2.Filter("type", "=", "relationship")])

blocks_data = []
uses_data = []

for rel in relationships:
    source = rel.get("source_ref")
    target = rel.get("target_ref")
    rel_type = rel.get("relationship_type")

    # Map: Mitigation blocks Technique (Validating IDs in memory to avoid crashing)
    if source.startswith("course-of-action--") and target.startswith("attack-pattern--") and rel_type == "mitigates":
        if source in valid_mitigations and target in valid_techniques:
            blocks_data.append({"mitigation_id": source, "technique_id": target})

    # Map: Threat Group uses Technique
    elif source.startswith("intrusion-set--") and target.startswith("attack-pattern--") and rel_type == "uses":
        if source in valid_groups and target in valid_techniques:
            uses_data.append({"group_id": source, "technique_id": target})

batch_upsert("mitigation_blocks_technique", blocks_data)
batch_upsert("group_uses_technique", uses_data)
print(f"Successfully batch uploaded {len(blocks_data)} Mitigation relationships and {len(uses_data)} Threat Actor behaviors.")

print("Data sync complete! Execution time drastically reduced.")