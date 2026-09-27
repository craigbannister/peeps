import { useEffect, useState } from "react";

export interface BuildingState {
  id: string;
  type: string;
  x: number;
  y: number;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

/** Buildings rarely change, so one fetch on mount is enough for now. */
export function useBuildings() {
  const [buildings, setBuildings] = useState<BuildingState[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/buildings`)
      .then((r) => r.json())
      .then(setBuildings)
      .catch((err) => console.error("Failed to load buildings:", err));
  }, []);

  return buildings;
}
