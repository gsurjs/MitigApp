"use client";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [mitigations, setMitigations] = useState([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [exposedActors, setExposedActors] = useState([]);

  // 1. Fetch Mitigations on Load
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/mitigations")
      .then((res) => res.json())
      .then((data) => setMitigations(data));
  }, []);

  // 2. Fetch Threat Actors whenever checkboxes change
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mitigated_ids: checkedIds }),
    })
      .then((res) => res.json())
      .then((data) => setExposedActors(data.exposed_actors || []));
  }, [checkedIds]);

  // Handle Checkbox Toggles
  const handleToggle = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <main className="flex h-screen bg-gray-950 text-green-400 font-mono p-4">
      
      {/* LEFT PANEL: Mitigations */}
      <div className="w-1/3 border-r border-green-800 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-white">Defensive Posture</h2>
        {mitigations.map((mit: any) => (
          <div key={mit.id} className="flex items-start mb-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 mr-3 accent-green-500"
              onChange={() => handleToggle(mit.id)}
            />
            <div>
              <p className="font-bold text-gray-200">{mit.mitre_id}</p>
              <p className="text-xs text-gray-400">{mit.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT PANEL: Intelligence Output */}
      <div className="w-2/3 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-red-500">Exposed Threat Actors</h2>
        <div className="grid grid-cols-2 gap-4">
          {exposedActors.map((actor: any) => (
            <div key={actor.id} className="border border-red-900 bg-red-950/20 p-4 rounded">
              {/* Styling with curly braces for a raw data feed aesthetic */}
              <h3 className="text-lg font-bold text-red-400">&#123; {actor.name} &#125;</h3>
              <p className="text-sm text-gray-300 mt-2">{actor.description?.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}