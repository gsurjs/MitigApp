"use client";
import { useState, useEffect } from "react";

// Helper function to strip Markdown links from MITRE's descriptions
const cleanDescription = (text: string) => {
  if (!text) return "No description available in STIX data.";
  // Converts [TeamTNT](https://...) to just "TeamTNT"
  const plainText = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return plainText.length > 150 ? plainText.substring(0, 150) + "..." : plainText;
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
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("All Sectors");

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

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/mitigations`)
      .then((res) => res.json())
      .then((data) => setMitigations(data));

    // Emerging Vectors fetch
    fetch(`${API_BASE_URL}/api/emerging-vectors`)
      .then((res) => res.json())
      .then((data) => setEmergingVectors(data));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitigated_ids: checkedIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        setExposedActors(data.exposed_actors || []);
        setRecommendations(data.recommendations || []);
      });
  }, [checkedIds]);

  const handleToggle = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Reset function
  const handleReset = () => {
    setCheckedIds([]);
    setSearchTerm("");
    setActorSearch("");
    setSectorFilter("All Sectors");
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

      // If 'a' is checked but 'b' is not, 'a' moves up
      if (aChecked && !bChecked) return -1;
      
      // If 'b' is checked but 'a' is not, 'b' moves up
      if (!aChecked && bChecked) return 1;
      
      // If both share the same status, sort them alphabetically by MITRE ID
      return a.mitre_id.localeCompare(b.mitre_id);
    });

  // Check if anything is currently active
  const isBoardActive = checkedIds.length > 0 || searchTerm !== "" || actorSearch !== "" || sectorFilter !== "All Sectors";
  // Process vectors to determine affected industries based on associated threat groups
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
            
            {/* Dynamic Clear Board Button */}
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
        {/* Dynamic Risk Header */}
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
              
              {/* Subtitle locked directly beneath the title */}
              <p className="text-sm text-slate-400 mt-1 pl-11 sm:pl-7">Dynamic vulnerability mapping</p>
            </div>

            {/* Actor Search Bar */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 w-full sm:pl-7">
              {/* Text Search */}
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
              
              {/* Industry/Sector Dropdown */}
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
                {/* Custom dropdown arrow to match the theme */}
                <svg className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
              {/* NEW: Live Intel Feed Button */}
              <button 
                onClick={() => setIsIntelFeedOpen(true)}
                className="print:hidden hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Live Intel Feed
              </button>


            </div>
          </div>

          <div className="flex sm:block justify-between items-end sm:text-right border-t border-slate-800/50 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
            <p className="text-sm text-slate-400 font-medium mb-1">Exposed Actors</p>
            <p className={`text-3xl md:text-4xl font-bold tracking-tight ${filteredActors.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {filteredActors.length}
            </p>
          </div>
        </div>

        {/* Remediation Roadmap Engine */}
        {recommendations.length > 0 && (
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
          {filteredActors.length === 0 ? (
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
                  
                  {/* Granular Risk Scoring Bar */}
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

                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    {cleanDescription(actor.description)}
                  </p>
                  
                  {/* Expandable Exposed Vectors List */}
                  {actor.exposed_techniques && actor.exposed_techniques.length > 0 && (
                    <details className="mt-4 md:mt-5 group border-t border-slate-800/60 pt-3 md:pt-4">
                      <summary className="text-[10px] md:text-sm font-medium text-blue-400 cursor-pointer list-none flex items-center hover:text-blue-300 transition-colors w-fit">
                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-1.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        View {actor.exposed_vectors} exposed vectors
                      </summary>
                      <div className="mt-3 max-h-40 md:max-h-48 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                        <ul className="space-y-1.5 md:space-y-2">
                          {actor.exposed_techniques.map((tech: any) => (
                            <li key={tech.mitre_id} className="text-[10px] md:text-xs flex justify-between items-center p-2 md:p-2.5 bg-slate-950/50 rounded-md border border-slate-800/80 gap-2">
                              <span className="font-medium text-slate-300 truncate">{tech.name}</span>
                              <span className="font-mono text-slate-500 text-[8px] md:text-[10px] flex-shrink-0">{tech.mitre_id}</span>
                            </li>
                          ))}
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
      {/* Overlay to close the drawer when clicking outside */}
      {isIntelFeedOpen && (
        <div 
          className="fixed inset-0 z-40 print:hidden"
          onClick={() => setIsIntelFeedOpen(false)}
        />
      )}
      <div className={`fixed inset-y-0 right-0 z-50 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${isIntelFeedOpen ? "translate-x-0" : "translate-x-full"} print:hidden flex flex-col`}>
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
            // Strip markdown links for a cleaner read, but keep the full length for the details panel
            const fullDescription = vec.description 
              ? vec.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') 
              : "No detailed description available in STIX data.";

            return (
              <div key={vec.mitre_id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl hover:border-emerald-500/30 transition-colors shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">{vec.mitre_id}</span>
                  <span className="text-[10px] font-medium text-emerald-500/80 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {new Date(vec.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-200 leading-snug mb-3">{vec.name}</p>
                
                {/* Modal Trigger Button */}
                <button 
                  onClick={() => setSelectedVector(vec)}
                  className="mt-2 mb-3 text-[10px] font-medium text-emerald-400 flex items-center hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded border border-emerald-500/30 w-fit"
                >
                  {/* Eye Icon */}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 print:hidden">
          {/* Blurred Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedVector(null)}
          />
          
          {/* Modal Container */}
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
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
            
            {/* Modal Body */}
            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-900 text-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                MITRE ATT&CK Description
              </h4>
              <div className="text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/50 p-4 rounded-lg border border-slate-800/80">
                {selectedVector.description 
                  ? selectedVector.description.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') 
                  : "No detailed description available in STIX data."}
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
            
            {/* Modal Footer */}
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