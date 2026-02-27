"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [mitigations, setMitigations] = useState<any[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [exposedActors, setExposedActors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);

  // 1. Fetch Mitigations on Load
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/mitigations")
      .then((res) => res.json())
      .then((data) => setMitigations(data));
  }, []);

  // 2. Fetch Threat Actors when checkboxes change
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitigated_ids: checkedIds }),
    })
      .then((res) => res.json())
      .then((data) => {
        setExposedActors(data.exposed_actors || []);
        setRecommendations(data.recommendations || []); // Capture the roadmap
      });
  }, [checkedIds]);

  // Handle Checkbox Toggles
  const handleToggle = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter mitigations based on search input
  const filteredMitigations = mitigations.filter(
    (mit) =>
      mit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mit.mitre_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="flex h-screen bg-neutral-950 text-green-400 font-mono overflow-hidden">
      
      {/* LEFT PANEL: Defensive Posture Controls */}
      <div className="w-1/3 flex flex-col border-r border-green-900 bg-neutral-900/50">
        <div className="p-6 border-b border-green-900">
          <h2 className="text-2xl font-bold text-white mb-2">Defensive Posture</h2>
          <p className="text-sm text-gray-400 mb-4">Select active mitigations to calculate risk.</p>
          <input
            type="text"
            placeholder="Search mitigations (e.g. M1031)..."
            className="w-full bg-neutral-950 border border-green-800 text-green-400 p-2 rounded focus:outline-none focus:border-green-500 placeholder-green-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {filteredMitigations.map((mit: any) => (
            <div key={mit.id} className="flex items-start mb-4 cursor-pointer hover:bg-neutral-800/50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                className="mt-1 mr-3 w-4 h-4 accent-green-600 cursor-pointer"
                onChange={() => handleToggle(mit.id)}
              />
              <div>
                <p className="font-bold text-gray-200">{mit.mitre_id} - {mit.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: Intelligence Output */}
      <div className="w-2/3 flex flex-col bg-neutral-950">
        {/* Dynamic Risk Header */}
        <div className={`p-6 border-b flex justify-between items-center transition-colors duration-500 ${exposedActors.length > 0 ? 'border-red-900 bg-red-950/20' : 'border-green-900 bg-green-950/20'}`}>
          <h2 className={`text-2xl font-bold ${exposedActors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
            Live Threat Matrix
          </h2>
          <div className="text-right">
            <p className="text-sm text-gray-400">Exposed Actors</p>
            <p className={`text-3xl font-black ${exposedActors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {exposedActors.length}
            </p>
          </div>
        </div>

        {/* Remediation Roadmap Engine */}
        {recommendations.length > 0 && (
          <div className="p-6 border-b border-neutral-800 bg-neutral-900/30">
            <h3 className="text-lg font-bold text-yellow-500 mb-3">Priority Remediation Roadmap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec, index) => (
                <div key={rec.id} className="border border-yellow-900/50 bg-yellow-950/20 p-4 rounded cursor-pointer hover:bg-yellow-900/40 transition-colors" onClick={() => handleToggle(rec.id)}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-yellow-500 font-bold text-sm">Step {index + 1}</span>
                    <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded">Impact Score: {rec.impact_score}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-200">{rec.mitre_id}: {rec.name}</p>
                  <p className="text-xs text-gray-400 mt-2">Click to implement and simulate risk reduction.</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threat Actor Feed */}
        <div className="flex-1 overflow-y-auto p-6">
          {exposedActors.length === 0 ? (
            <div className="flex h-full items-center justify-center text-green-500/50 text-xl font-bold">
              [ NO UNMITIGATED THREATS DETECTED ]
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {exposedActors.map((actor: any) => (
                <div key={actor.mitre_id || actor.id} className="border border-red-900/50 bg-neutral-900 p-5 rounded shadow-lg">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-red-400">
                      &#123; "{actor.name}" &#125;
                    </h3>
                    <span className="text-xs bg-red-950 border border-red-800 text-red-300 px-2 py-1 rounded">
                      {actor.mitre_id}
                    </span>
                  </div>
                  
                  {/* NEW: Granular Risk Scoring Bar */}
                  <div className="my-4 bg-neutral-950 p-3 rounded border border-neutral-800">
                    <div className="flex justify-between text-xs mb-1 text-gray-400">
                      <span>Mitigation Progress</span>
                      <span>{actor.mitigation_percent}% Protected</span>
                    </div>
                    <div className="w-full bg-red-950 rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${actor.mitigation_percent}%` }}></div>
                    </div>
                    <p className="text-xs text-red-400 mt-2 text-right">
                      {actor.exposed_vectors} / {actor.total_vectors} attack vectors still open
                    </p>
                  </div>

                  <p className="text-sm text-gray-400 leading-relaxed">
                    {actor.description ? `${actor.description.substring(0, 150)}...` : "No description available in STIX data."}
                  </p>
                  
                  {/* Kept your aliases section intact */}
                  {actor.aliases && actor.aliases.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <p className="text-xs text-neutral-500">Aliases: {actor.aliases.join(', ')}</p>
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