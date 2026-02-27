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
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/mitigations")
      .then((res) => res.json())
      .then((data) => setMitigations(data));
  }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/analyze", {
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

  const filteredMitigations = mitigations.filter(
    (mit) =>
      mit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mit.mitre_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    // Switched to a clean sans-serif font and light slate background
    <main className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* LEFT PANEL: Defensive Posture Controls */}
      <div className="w-1/3 flex flex-col border-r border-slate-200 bg-white shadow-sm z-10">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Defensive Posture</h2>
          <p className="text-sm text-slate-500 mb-4">Select active mitigations to assess current risk exposure.</p>
          <input
            type="text"
            placeholder="Search mitigations (e.g. M1031)..."
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {filteredMitigations.map((mit: any) => (
            <div key={mit.id} className="flex items-start mb-2 cursor-pointer hover:bg-slate-50 p-3 rounded-lg transition-colors border border-transparent hover:border-slate-100">
              <input
                type="checkbox"
                className="mt-0.5 mr-3 w-4 h-4 accent-blue-600 cursor-pointer rounded border-slate-300"
                checked={checkedIds.includes(mit.id)}
                onChange={() => handleToggle(mit.id)}
              />
              <div>
                <p className="font-semibold text-slate-800 text-sm">{mit.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{mit.mitre_id}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Intelligence Output */}
      <div className="w-2/3 flex flex-col bg-slate-50">
        {/* Dynamic Risk Header */}
        <div className={`p-6 border-b flex justify-between items-center transition-colors duration-500 ${exposedActors.length > 0 ? 'bg-white border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Threat Matrix Analysis</h2>
            <p className="text-sm text-slate-500 mt-1">Real-time vulnerability mapping</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500 font-medium">Exposed Actors</p>
            <p className={`text-4xl font-black tracking-tight ${exposedActors.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {exposedActors.length}
            </p>
          </div>
        </div>

        {/* Remediation Roadmap Engine */}
        {recommendations.length > 0 && (
          <div className="p-6 bg-blue-50/50 border-b border-blue-100">
            <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4">Priority Remediation Roadmap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec, index) => (
                <div 
                  key={rec.id} 
                  className="bg-white border border-blue-200 p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all border-l-4 border-l-blue-500 group" 
                  onClick={() => handleToggle(rec.id)}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wide">Step {index + 1}</span>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Impact: {rec.impact_score} vectors</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-snug">{rec.name}</p>
                  <p className="text-xs text-slate-500 mt-3 group-hover:text-blue-600 transition-colors">Click to simulate implementation &rarr;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threat Actor Feed */}
        <div className="flex-1 overflow-y-auto p-6">
          {exposedActors.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-emerald-600">
              <div className="bg-emerald-100 p-4 rounded-full mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-xl font-bold">Network Secure</p>
              <p className="text-sm text-emerald-600/70 mt-2">No unmitigated threat actors detected.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {exposedActors.map((actor: any) => (
                <div key={actor.mitre_id || actor.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    {/* Removed JSON brackets */}
                    <h3 className="text-lg font-bold text-slate-900">
                      {actor.name}
                    </h3>
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md">
                      {actor.mitre_id}
                    </span>
                  </div>
                  
                  {/* Granular Risk Scoring Bar */}
                  <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-slate-600">
                      <span>Mitigation Progress</span>
                      <span>{actor.mitigation_percent}% Protected</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${actor.mitigation_percent}%` }}></div>
                    </div>
                    <p className="text-xs text-rose-600 mt-2 text-right font-medium">
                      {actor.exposed_vectors} / {actor.total_vectors} vectors exposed
                    </p>
                  </div>

                  {/* Cleaned Description */}
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {cleanDescription(actor.description)}
                  </p>
                  
                  {actor.aliases && actor.aliases.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Aliases: </span>
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