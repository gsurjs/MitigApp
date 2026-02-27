import os
from fastapi import FastAPI
from dotenv import load_dotenv
from supabase import create_client, Client

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