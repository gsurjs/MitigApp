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
  const [searchTerm, setSearchTerm] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/mitigations`)
      .then((res) => res.json())
      .then((data) => setMitigations(data));
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

  const filteredActors = exposedActors.filter(
    (actor) =>
      actor.name.toLowerCase().includes(actorSearch.toLowerCase()) ||
      actor.mitre_id.toLowerCase().includes(actorSearch.toLowerCase())
  );

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

  return (
    <main className="flex h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* LEFT PANEL: Defensive Posture Controls */}
      <div className="w-1/3 flex flex-col border-r border-slate-800 bg-slate-900 z-10">
        <div className="p-6 border-b border-slate-800">
          {/* UPDATED: Blue Shield Icon and Blue Title */}
          <h2 className="text-xl font-bold text-blue-400 mb-1 tracking-tight flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            Defensive Posture
          </h2>
          <p className="text-sm text-slate-400 mb-5 pl-7">Select active mitigations to assess risk exposure.</p>
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
                className="mt-0.5 mr-3 w-4 h-4 accent-blue-500 cursor-pointer rounded border-slate-600 bg-slate-800"
                checked={checkedIds.includes(mit.id)}
                onChange={() => handleToggle(mit.id)}
              />
              <div>
                <p className="font-medium text-slate-200 text-sm">{mit.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{mit.mitre_id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Intelligence Output */}
      <div className="w-2/3 flex flex-col bg-slate-950/50 relative">
        {/* Dynamic Risk Header */}
        <div className={`p-6 border-b flex justify-between items-start transition-colors duration-500 ${exposedActors.length > 0 ? 'bg-slate-900 border-slate-800' : 'bg-emerald-900/10 border-emerald-900/30'}`}>
          <div className="flex-1">
            <h2 className={`text-xl font-bold tracking-tight flex items-center gap-2 ${exposedActors.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Threat Matrix Analysis
            </h2>
            <p className="text-sm text-slate-400 mt-3 pl-7">Dynamic vulnerability mapping</p>
            
            {/* Actor Search Bar */}
            <div className="mt-4 relative max-w-sm pl-7">
              <input
                type="text"
                placeholder="Find threat group..."
                className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 p-2 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 transition-colors text-xs placeholder-slate-600"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
              />
              <svg className="w-3.5 h-3.5 absolute left-10 top-2.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-400 font-medium mb-1">Exposed Actors</p>
            <p className={`text-4xl font-bold tracking-tight ${exposedActors.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {exposedActors.length}
            </p>
          </div>
        </div>

        {/* Remediation Roadmap Engine */}
        {recommendations.length > 0 && (
          <div className="p-6 bg-slate-900 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Priority Remediation Roadmap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={rec.id} 
                  className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 transition-all border-l-4 border-l-blue-500 group" 
                  onClick={() => handleToggle(rec.id)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-blue-400 font-bold text-xs uppercase tracking-wide">Step {index + 1}</span>
                    <span className="text-[10px] font-medium text-slate-300 bg-slate-700/50 px-2 py-1 rounded-full border border-slate-600">Impact: {rec.impact_score} vectors</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 leading-snug">{rec.name}</p>
                  <p className="text-xs text-slate-500 mt-3 group-hover:text-blue-400 transition-colors">Click to simulate implementation &rarr;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threat Actor Feed */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredActors.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-emerald-500">
              <div className="bg-emerald-500/10 p-4 rounded-full mb-4 border border-emerald-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-xl font-bold">Network Secure</p>
              <p className="text-sm text-emerald-500/70 mt-2">No unmitigated threat actors detected.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 transition-all duration-500">
              {filteredActors.map((actor: any) => (
                <div key={actor.mitre_id || actor.id} className="bg-slate-900 border border-slate-800 p-6 rounded-xl hover:border-slate-700 transition-colors shadow-sm">
                  
                  <div className="flex justify-between items-start mb-5">
                    <h3 className="text-lg font-bold text-rose-500 tracking-tight">
                      {actor.name}
                    </h3>
                    <span className="text-xs font-mono bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-md">
                      {actor.mitre_id}
                    </span>
                  </div>
                  
                  {/* Granular Risk Scoring Bar */}
                  <div className="mb-5 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/50">
                    <div className="flex justify-between text-xs mb-2 font-medium text-slate-400">
                      <span>Mitigation Status</span>
                      <span className="text-emerald-400">{actor.mitigation_percent}% Protected</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${actor.mitigation_percent}%` }}></div>
                    </div>
                    <p className="text-xs text-rose-400 mt-2 text-right font-medium">
                      {actor.exposed_vectors} / {actor.total_vectors} vectors exposed
                    </p>
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed">
                    {cleanDescription(actor.description)}
                  </p>
                  
                  {/* Expandable Exposed Vectors List */}
                  {actor.exposed_techniques && actor.exposed_techniques.length > 0 && (
                    <details className="mt-5 group border-t border-slate-800/60 pt-4">
                      <summary className="text-sm font-medium text-blue-400 cursor-pointer list-none flex items-center hover:text-blue-300 transition-colors w-fit">
                        <svg className="w-4 h-4 mr-1.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        View {actor.exposed_vectors} exposed vectors
                      </summary>
                      <div className="mt-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        <ul className="space-y-2">
                          {actor.exposed_techniques.map((tech: any) => (
                            <li key={tech.mitre_id} className="text-xs flex justify-between items-center p-2.5 bg-slate-950/50 rounded-md border border-slate-800/80">
                              <span className="font-medium text-slate-300">{tech.name}</span>
                              <span className="font-mono text-slate-500 text-[10px]">{tech.mitre_id}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  )}

                  {actor.aliases && actor.aliases.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-slate-800/60">
                      <p className="text-xs text-slate-400 leading-relaxed">
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
    </main>
  );
}