"use client";
import { useState, useEffect } from "react";

// Helper function to strip Markdown links from MITRE's descriptions
const cleanDescription = (text: string) => {
  if (!text) return "No description available in STIX data.";
  // Converts [TeamTNT](https://...) to just "TeamTNT"
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};

export default function Dashboard() {
  const [mitigations, setMitigations] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [exposedActors, setExposedActors] = useState<any[]>([]);
  const [emergingVectors, setEmergingVectors] = useState<any[]>([]);
  const [isIntelFeedOpen, setIsIntelFeedOpen] = useState(false);
  const [selectedVector, setSelectedVector] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("All Sectors");
  
  // Loading States
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [expandedActors, setExpandedActors] = useState<string[]>([]);

  const [activeTelemetry, setActiveTelemetry] = useState<any[]>([]);

  const toggleActorDescription = (id: string) => {
    setExpandedActors((prev) => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const SECTORS = [
    { label: "All Sectors", keywords: [] },
    { label: "Financial / Banking", keywords: ["financial", "bank", "atm", "crypto", "swift", "pos"] },
    { label: "Government / Diplomatic", keywords: ["government", "diplomat", "embassy", "ministry", "state-sponsored"] },
    { label: "Defense / Aerospace", keywords: ["defense", "military", "aerospace", "contractor", "aviation"] },
    { label: "Healthcare / Medical", keywords: ["health", "hospital", "medical", "pharma"] },
    { label: "Energy / ICS", keywords: ["energy", "oil", "gas", "industrial", "ics", "power", "utility"] },
    { label: "Retail / Hospitality", keywords: ["retail", "hospitality", "restaurant", "point of sale"] },
    { label: "Technology / Telecom", keywords: ["technology", "telecom", "software", "it provider"] },
  ];

  // 1. Initial Data Load (Mitigations, Vectors & Telemetry)
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/mitigations`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/emerging-vectors`).then(res => res.json()),
      fetch(`${API_BASE_URL}/api/telemetry/active`).then(res => res.json())
    ])
    .then(([mitigationsData, vectorsData, telemetryData]) => {
      setMitigations(Array.isArray(mitigationsData) ? mitigationsData : []);
      setEmergingVectors(Array.isArray(vectorsData) ? vectorsData : []);
      setActiveTelemetry(Array.isArray(telemetryData) ? telemetryData : []);
      setIsInitialLoading(false);
    })
    .catch(err => {
      console.error("Failed to fetch initial data:", err);
      setIsInitialLoading(false);
    });
  }, []);

  // 2. Dynamic Risk Analysis Load (Runs when checkboxes change)
  useEffect(() => {
    setIsAnalyzing(true);
    fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitigated_ids: checkedIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        setExposedActors(data.exposed_actors || []);
        setRecommendations(data.recommendations || []);
        setIsAnalyzing(false);
      })
      .catch(err => {
        console.error("Analysis failed:", err);
        setIsAnalyzing(false);
      });
  }, [checkedIds]);

  const handleToggle = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };
  // Sector-Specific Executive Demo Simulation (Writes to Supabase)
  const runSimulation = async () => {
    // 1. Define custom, highly realistic attack logs for each sector
    const simulationScenarios: Record<string, any[]> = {
      "Financial / Banking": [
        { source: "SWIFT Gateway", log_message: "CRITICAL: Unauthorized SWIFT transaction attempt blocked. Banking trojan suspected." },
        { source: "WAF Proxy", log_message: "ALERT: SQL Injection payload detected targeting customer database: ' OR 1=1--" },
        { source: "ATM Network", log_message: "WARNING: ATM jackpotting malware signature detected on Segment B." },
        { source: "Endpoint AV", log_message: "ALERT: Credential dumping tool (mimikatz) blocked on teller workstation." }
      ],
      "Healthcare / Medical": [
        { source: "Medical IoT VLAN", log_message: "ALERT: Unauthorized access attempt on MRI machine interface." },
        { source: "Email Gateway", log_message: "CRITICAL: 120 phishing emails targeting nursing staff bypassed filter." },
        { source: "File Server", log_message: "WARNING: Massive file encryption detected. Ransomware behavior targeting EHR records." },
        { source: "Endpoint AV", log_message: "ALERT: Suspicious powershell execution bypassing policy on reception PC." }
      ],
      "Energy / ICS": [
        { source: "SCADA Firewall", log_message: "CRITICAL: Unauthorized Modbus protocol manipulation detected." },
        { source: "Engineering Workstation", log_message: "ALERT: Ransomware encrypting project files." },
        { source: "VPN Gateway", log_message: "WARNING: Brute force login attempt on industrial VPN portal." },
        { source: "Network Sensor", log_message: "ALERT: Suspicious network service discovery scan (nmap) on ICS segment." }
      ],
      "Government / Diplomatic": [
        { source: "Email Gateway", log_message: "ALERT: Spearphishing campaign detected from known state-sponsored actor." },
        { source: "Domain Controller", log_message: "WARNING: Multiple failed logins. Brute force credential access detected." },
        { source: "Endpoint AV", log_message: "CRITICAL: Mimikatz credential dumping detected on administrator endpoint." },
        { source: "Network IDS", log_message: "ALERT: Suspicious data exfiltration over encrypted tunnel." }
      ],
      "Retail / Hospitality": [
        { source: "POS Network", log_message: "CRITICAL: Point-of-Sale memory scraping malware detected." },
        { source: "Web Frontend", log_message: "ALERT: DDoS attempt detected. Req/sec > 10000. Rate limit exceeded." },
        { source: "Database", log_message: "WARNING: SQL Injection attempt targeting customer credit card tables." },
        { source: "Guest WiFi", log_message: "ALERT: Man-in-the-Middle (MitM) spoofing detected on guest network." }
      ],
      // The default payload used if "All Sectors" or an unmapped sector is selected
      "Default": [
        { source: "IIS Webserver", log_message: "ALERT: DDoS attempt detected. Req/sec > 10000 from IP 192.168.1.5" },
        { source: "Email Gateway", log_message: "CRITICAL: 47 phishing attachments detected and bypassed filter." },
        { source: "WAF Proxy", log_message: "ALERT: SQL Injection payload detected in login form: ' OR 1=1--" },
        { source: "Endpoint AV", log_message: "WARNING: Malicious Command and Scripting Interpreter bypass detected via PowerShell." }
      ]
    };

    const logsToFire = simulationScenarios[sectorFilter] || simulationScenarios["Default"];

    try {
      // 3. Fire the tailored logs to the backend
      for (const log of logsToFire) {
        const ingestRes = await fetch(`${API_BASE_URL}/api/telemetry/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log)
        });
        
        // NEW ALARM: If Railway returns a 404, yell at us!
        if (!ingestRes.ok) {
           alert(`Backend Error ${ingestRes.status}: Railway cannot find the /ingest endpoint! Are you sure your main.py file was successfully deployed to Railway?`);
           return;
        }
      }
      
      // 4. Refresh the UI with the newly saved database events
      const res = await fetch(`${API_BASE_URL}/api/telemetry/active`);
      if (!res.ok) throw new Error("Fetch active telemetry failed");
      
      const data = await res.json();
      setActiveTelemetry(Array.isArray(data) ? data : []);
      
    } catch (error) {
      alert("Network Error: Could not reach the API. Check if your NEXT_PUBLIC_API_URL is correct in Vercel.");
      console.error(error);
    }
  };
  

  // Reset function (Now clears Telemetry from DB)
  const handleReset = async () => {
    setCheckedIds([]);
    setSearchTerm("");
    setActorSearch("");
    setSectorFilter("All Sectors");
    
    try {
      await fetch(`${API_BASE_URL}/api/telemetry/clear`, { method: "POST" });
      setActiveTelemetry([]);
    } catch (err) {
      console.error("Failed to clear telemetry:", err);
    }
  };

  const filteredActors = exposedActors.filter((actor) => {
    // 1. Text Search Logic
    const searchLower = actorSearch.toLowerCase();
    const matchesName = actor.name.toLowerCase().includes(searchLower);
    const matchesId = actor.mitre_id.toLowerCase().includes(searchLower);
    const matchesAlias = actor.aliases 
      ? actor.aliases.some((alias: string) => alias.toLowerCase().includes(searchLower))
      : false;
    const matchesSearch = matchesName || matchesId || matchesAlias;

    // 2. Industry Sector Logic
    let matchesSector = true;
    if (sectorFilter !== "All Sectors") {
      const selectedSector = SECTORS.find(s => s.label === sectorFilter);
      if (selectedSector && selectedSector.keywords.length > 0) {
        const descLower = (actor.description || "").toLowerCase();
        matchesSector = selectedSector.keywords.some(kw => descLower.includes(kw));
      }
    }

    return matchesSearch && matchesSector;
  });

  const filteredMitigations = mitigations
    .filter((mit) =>
      mit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mit.mitre_id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aChecked = checkedIds.includes(a.id);
      const bChecked = checkedIds.includes(b.id);

      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      return a.mitre_id.localeCompare(b.mitre_id);
    });

  const isBoardActive = checkedIds.length > 0 || searchTerm !== "" || actorSearch !== "" || sectorFilter !== "All Sectors" || activeTelemetry.length > 0;
  
  const processedEmergingVectors = emergingVectors.map(vector => {
    const affectedSectors = new Set<string>();
    vector.associated_descriptions.forEach((desc: string) => {
      const descLower = desc.toLowerCase();
      SECTORS.forEach(sector => {
        if (sector.label !== "All Sectors" && sector.keywords.some(kw => descLower.includes(kw))) {
          affectedSectors.add(sector.label);
        }
      });
    });
    return { ...vector, sectors: Array.from(affectedSectors) };
  });

  return (
    <main className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30 relative">
      
      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* LEFT PANEL: Defensive Posture Controls */}
      <div className={`fixed inset-y-0 left-0 z-50 w-4/5 max-w-sm flex flex-col border-r border-slate-800 bg-slate-900 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-1/3 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        
        <div className="p-6 border-b border-slate-800 relative">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-blue-400 mb-1 tracking-tight flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                Defensive Posture
              </h2>
              <p className="text-sm text-slate-400 mb-4 pl-7 pr-8 md:pr-0">Select active mitigations to assess risk exposure.</p>
            </div>
            
            {isBoardActive && (
              <button 
                onClick={handleReset}
                className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-rose-400 transition-colors bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700 hover:border-rose-900/50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Clear
              </button>
            )}
          </div>
          
          <button className="md:hidden absolute top-6 right-4 text-slate-400 hover:text-white p-1" onClick={() => setIsMobileMenuOpen(false)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Search mitigations (e.g. M1031)..."
              className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 p-2.5 pl-10 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm placeholder-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {filteredMitigations.map((mit: any) => (
            <div key={mit.id} className="flex items-start mb-1 cursor-pointer hover:bg-slate-800/50 p-3 rounded-lg transition-colors border border-transparent hover:border-slate-700 group">
              <input
                type="checkbox"
                className="mt-0.5 mr-3 w-4 h-4 accent-blue-500 cursor-pointer rounded border-slate-600 bg-slate-800 flex-shrink-0"
                checked={checkedIds.includes(mit.id)}
                onChange={() => handleToggle(mit.id)}
              />
              <div>
                <p className="font-medium text-slate-200 text-sm leading-tight">{mit.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{mit.mitre_id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Intelligence Output */}
      <div className="w-full md:w-2/3 flex flex-col flex-1 bg-slate-950/50 relative overflow-hidden">
        <div className={`p-4 md:p-6 border-b flex flex-col sm:flex-row sm:justify-between sm:items-start transition-colors duration-500 gap-4 ${exposedActors.length > 0 ? 'bg-slate-900 border-slate-800' : 'bg-emerald-900/10 border-emerald-900/30'}`}>
          <div className="flex-1">
            <div className="flex flex-col mb-4">
              <div className="flex items-center gap-3">
                <button 
                  className="md:hidden p-1.5 bg-slate-800 rounded border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                
                <h2 className={`text-xl font-bold tracking-tight flex items-center gap-2 ${exposedActors.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  <svg className="w-5 h-5 hidden sm:block flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  Threat Matrix Analysis
                </h2>
              </div>
              
              <p className="text-sm text-slate-400 mt-1 pl-11 sm:pl-7">Dynamic vulnerability mapping</p>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full sm:pl-7">
              <div className="relative flex-1 sm:max-w-sm">
                <input
                  type="text"
                  placeholder="Find threat group..."
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 p-2 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors text-xs placeholder-slate-600"
                  value={actorSearch}
                  onChange={(e) => setActorSearch(e.target.value)}
                />
                <svg className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              
              <div className="relative w-full sm:w-48">
                <select
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-300 p-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors text-xs appearance-none cursor-pointer"
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                >
                  {SECTORS.map((sector) => (
                    <option key={sector.label} value={sector.label}>
                      {sector.label}
                    </option>
                  ))}
                </select>
                <svg className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>

              {/* Live Intel Feed Button (Desktop) */}
              <button 
                onClick={() => setIsIntelFeedOpen(true)}
                className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Live Intel Feed
              </button>
              
              {/* Simulate Attack Button (Desktop) */}
              <button 
                onClick={runSimulation}
                className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Simulate Attack
              </button>
            </div>
          </div>

          <div className="flex sm:block justify-between items-end sm:text-right border-t border-slate-800/50 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
            {/* Mobile Buttons */}
            <div className="sm:hidden flex flex-col gap-2 mb-2">
              <button 
                onClick={() => setIsIntelFeedOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Live Intel
              </button>

              <button 
                onClick={runSimulation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Simulate Attack
              </button>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-slate-400 font-medium mb-1">Exposed Actors</p>
              <p className={`text-3xl md:text-4xl font-bold tracking-tight ${filteredActors.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {filteredActors.length}
              </p>
            </div>
          </div>
        </div>

        {/* Remediation Roadmap Engine */}
        {recommendations.length > 0 && !isInitialLoading && !isAnalyzing && (
          <div className="p-4 md:p-6 bg-slate-900 border-b border-slate-800">
            <h3 className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 md:mb-4">Priority Remediation Roadmap</h3>
            <div className="flex overflow-x-auto md:grid md:grid-cols-3 gap-3 pb-2 md:pb-0 hide-scrollbar snap-x">
              {recommendations.map((rec, index) => (
                <div 
                  key={rec.id} 
                  className="min-w-[240px] md:min-w-0 flex-shrink-0 bg-slate-800/50 border border-slate-700 p-3 md:p-4 rounded-xl cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 transition-all border-l-4 border-l-blue-500 group snap-start" 
                  onClick={() => handleToggle(rec.id)}
                >
                  <div className="flex justify-between items-center mb-2 md:mb-3">
                    <span className="text-blue-400 font-bold text-[10px] md:text-xs uppercase tracking-wide">Step {index + 1}</span>
                    <span className="text-[10px] font-medium text-slate-300 bg-slate-700/50 px-2 py-0.5 md:py-1 rounded-full border border-slate-600">Impact: {rec.impact_score} vectors</span>
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-slate-200 leading-snug truncate">{rec.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threat Actor Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isInitialLoading || isAnalyzing ? (
            <div className="flex flex-col h-full items-center justify-center text-blue-500 mt-10 md:mt-0">
              <svg className="animate-spin w-10 h-10 mb-4 text-blue-500/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg md:text-xl font-bold animate-pulse text-blue-400">Analyzing Threat Matrix...</p>
              <p className="text-xs text-slate-500 mt-2">Cross-referencing active mitigations</p>
            </div>
          ) : filteredActors.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-emerald-500 mt-10 md:mt-0">
              <div className="bg-emerald-500/10 p-4 rounded-full mb-4 border border-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-lg md:text-xl font-bold">Network Secure</p>
              <p className="text-xs md:text-sm text-emerald-500/70 mt-2 text-center px-4">No unmitigated threat actors detected.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 transition-all duration-500 pb-10">
              {filteredActors.map((actor: any) => (
                <div key={actor.mitre_id || actor.id} className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-xl shadow-sm">
                  
                  <div className="flex justify-between items-start mb-4 md:mb-5">
                    <h3 className="text-base md:text-lg font-bold text-rose-500 tracking-tight leading-tight pr-2">
                      {actor.name}
                    </h3>
                    <span className="text-[10px] md:text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded-md flex-shrink-0">
                      {actor.mitre_id}
                    </span>
                  </div>
                  
                  <div className="mb-4 md:mb-5 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                    <div className="flex justify-between text-[10px] md:text-xs mb-2 font-medium text-slate-400">
                      <span>Mitigation Status</span>
                      <span className="text-emerald-400">{actor.mitigation_percent}% Protected</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${actor.mitigation_percent}%` }}></div>
                    </div>
                    <p className="text-[10px] md:text-xs text-rose-400 mt-2 text-right font-medium">
                      {actor.exposed_vectors} / {actor.total_vectors} vectors exposed
                    </p>
                  </div>

                  {/* Dynamic Read More / Show Less */}
                  <div className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    {(() => {
                      const fullDesc = cleanDescription(actor.description);
                      const isExpanded = expandedActors.includes(actor.id);
                      const needsExpansion = fullDesc.length > 150;
                      
                      return (
                        <>
                          {isExpanded || !needsExpansion ? fullDesc : `${fullDesc.substring(0, 150)}...`}
                          {needsExpansion && (
                            <button 
                              onClick={() => toggleActorDescription(actor.id)}
                              className="text-blue-400 hover:text-blue-300 ml-1.5 font-semibold transition-colors focus:outline-none"
                            >
                              {isExpanded ? "Show less" : "Read more"}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  {actor.exposed_techniques && actor.exposed_techniques.length > 0 && (
                    <details className="mt-4 md:mt-5 group border-t border-slate-800/60 pt-3 md:pt-4">
                      <summary className="text-[10px] md:text-sm font-medium text-blue-400 cursor-pointer list-none flex items-center hover:text-blue-300 transition-colors w-fit">
                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-1.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        View {actor.exposed_vectors} exposed vectors
                      </summary>
                      <div className="mt-3 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                        <ul className="space-y-1.5 md:space-y-2">
                          {actor.exposed_techniques.map((tech: any) => {
                            
                            // Check if this vector matches our live database telemetry
                            const activeHits = activeTelemetry.filter(log => log.mitre_id === tech.mitre_id);
                            const isActiveThreat = activeHits.length > 0;

                            return (
                              <li key={tech.mitre_id} className={`text-[10px] md:text-xs flex flex-col p-2 md:p-2.5 rounded-md border gap-1 transition-colors ${isActiveThreat ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-950/50 border-slate-800/80'}`}>
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium truncate ${isActiveThreat ? 'text-rose-400' : 'text-slate-300'}`}>
                                    {isActiveThreat && <span className="animate-pulse mr-1.5 inline-block w-1.5 h-1.5 bg-rose-500 rounded-full"></span>}
                                    {tech.name}
                                  </span>
                                  <span className={`font-mono text-[8px] md:text-[10px] flex-shrink-0 ${isActiveThreat ? 'text-rose-500/70' : 'text-slate-500'}`}>
                                    {tech.mitre_id}
                                  </span>
                                </div>
                                
                                {/* Show the actual log reasoning if it's an active threat */}
                                {isActiveThreat && (
                                  <div className="mt-1 pt-1 border-t border-rose-900/50 text-[9px] text-rose-300/80 font-mono">
                                    <span className="font-bold">ACTIVE TELEMETRY ({activeHits[0].source}):</span> {activeHits[0].raw_log}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </details>
                  )}

                  {actor.aliases && actor.aliases.length > 0 && (
                    <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-slate-800/60">
                      <p className="text-[10px] md:text-xs text-slate-400 leading-relaxed">
                        <span className="font-semibold text-slate-300">Aliases: </span>
                        {actor.aliases.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* RIGHT SLIDE-OUT PANEL: Emerging Intel Feed */}
      {isIntelFeedOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setIsIntelFeedOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${isIntelFeedOpen ? "translate-x-0" : "translate-x-full"} flex flex-col`}>
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <div>
            <h2 className="text-lg font-bold text-emerald-400 tracking-tight flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Emerging Vectors
            </h2>
            <p className="text-[10px] text-slate-400 mt-1">Newly tracked MITRE techniques</p>
          </div>
          <button className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-md transition-colors border border-slate-700 hover:border-slate-500" onClick={() => setIsIntelFeedOpen(false)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {processedEmergingVectors.map((vec) => {
            const fullDescription = cleanDescription(vec.description);

            return (
              <div key={vec.mitre_id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl hover:border-emerald-500/30 transition-colors shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{vec.mitre_id}</span>
                  <span className="text-[10px] font-medium text-emerald-500/80 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {new Date(vec.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-200 leading-snug mb-3">{vec.name}</p>
                
                <button 
                  onClick={() => setSelectedVector(vec)}
                  className="mt-2 mb-3 text-[10px] font-medium text-emerald-400 flex items-center hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded border border-emerald-500/30 w-fit"
                >
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  Read Vector Details
                </button>

                <div className="space-y-1.5 pt-3 border-t border-slate-700/50">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Targeted Sectors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vec.sectors.length > 0 ? (
                      vec.sectors.map((sec: string) => (
                        <span key={sec} className="text-[9px] font-medium tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded">
                          {sec}
                        </span>
                      ))
                    ) : (
                      <span className="text-[9px] text-slate-500 border border-slate-700 bg-slate-800 px-1.5 py-0.5 rounded">Sector Agnostic</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* --- VECTOR DETAILS MODAL --- */}
      {selectedVector && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedVector(null)}
          />
          
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950/50">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {selectedVector.mitre_id}
                  </span>
                  <span className="text-[10px] font-medium text-emerald-500/80 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Discovered: {new Date(selectedVector.created).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h3 className="text-lg md:text-2xl font-bold text-slate-200 tracking-tight leading-tight">
                  {selectedVector.name}
                </h3>
              </div>
              <button 
                className="text-slate-400 hover:text-rose-400 p-1.5 bg-slate-800 hover:bg-slate-800/80 rounded-md transition-colors border border-slate-700 hover:border-rose-900/50 flex-shrink-0"
                onClick={() => setSelectedVector(null)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-900 text-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                MITRE ATT&CK Description
              </h4>
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/50 p-4 rounded-lg border border-slate-800/80">
                {cleanDescription(selectedVector.description)}
              </div>

              <div className="mt-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                  Targeted Industry Sectors
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedVector.sectors.length > 0 ? (
                    selectedVector.sectors.map((sec: string) => (
                      <span key={sec} className="text-[11px] md:text-xs font-medium tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md shadow-sm">
                        {sec}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] md:text-xs text-slate-400 border border-slate-700 bg-slate-800 px-2.5 py-1 rounded-md shadow-sm">Sector Agnostic</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
               <button 
                onClick={() => setSelectedVector(null)}
                className="px-5 py-2 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>
            
          </div>
        </div>
      )}
    </main>
  );
}