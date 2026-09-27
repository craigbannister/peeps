import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import type { PeepState, Activity } from "./types";
import type { BuildingState } from "./useBuildings";

const TILE_SIZE = 32;

const ACTIVITY_COLORS: Record<Activity, number> = {
  idle: 0x8a8f98,
  eating: 0xe0a84c,
  working: 0x4c9be0,
  sleeping: 0x6c5ce7,
  socializing: 0xe0567b,
};

const BUILDING_COLORS: Record<string, number> = {
  house: 0x5a6270,
  workshop: 0xb5834c,
  farm: 0x5f8a4c,
  market: 0x8c6ab0,
};

interface Props {
  peeps: PeepState[];
  buildings: BuildingState[];
  onSelect: (peep: PeepState) => void;
}

/**
 * Owns a single PixiJS Application for the lifetime of the component,
 * and reconciles a Graphics circle per peep on every prop update rather
 * than tearing down and rebuilding the scene each render.
 */
export function PixiCanvas({ peeps, buildings, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spritesRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const buildingsLayerRef = useRef<PIXI.Container | null>(null);
  const peepsRef = useRef<PeepState[]>(peeps);
  peepsRef.current = peeps;

  useEffect(() => {
    const app = new PIXI.Application({
      background: "#1b1f24",
      resizeTo: hostRef.current!,
      antialias: true,
    });
    appRef.current = app;
    hostRef.current!.appendChild(app.view as unknown as Node);

    // Simple ground grid so the world has some visual reference.
    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x2a2f37, 1);
    for (let x = 0; x < 40; x++) {
      grid.moveTo(x * TILE_SIZE, 0);
      grid.lineTo(x * TILE_SIZE, 40 * TILE_SIZE);
    }
    for (let y = 0; y < 40; y++) {
      grid.moveTo(0, y * TILE_SIZE);
      grid.lineTo(40 * TILE_SIZE, y * TILE_SIZE);
    }
    app.stage.addChild(grid);

    // Buildings sit below peeps and don't need per-frame reconciliation —
    // drawn once whenever the `buildings` list changes (see effect below).
    const buildingsLayer = new PIXI.Container();
    app.stage.addChild(buildingsLayer);
    buildingsLayerRef.current = buildingsLayer;

    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
      spritesRef.current.clear();
      buildingsLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = buildingsLayerRef.current;
    if (!layer) return;
    layer.removeChildren();
    for (const b of buildings) {
      const g = new PIXI.Graphics();
      g.beginFill(BUILDING_COLORS[b.type] ?? 0x777777);
      g.drawRoundedRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4, 4);
      g.endFill();
      g.x = b.x * TILE_SIZE;
      g.y = b.y * TILE_SIZE;
      layer.addChild(g);
    }
  }, [buildings]);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const sprites = spritesRef.current;
    const seen = new Set<string>();

    for (const peep of peeps) {
      seen.add(peep.id);
      let g = sprites.get(peep.id);
      if (!g) {
        g = new PIXI.Graphics();
        g.eventMode = "static";
        g.cursor = "pointer";
        g.on("pointerdown", () => onSelect(peep));
        app.stage.addChild(g);
        sprites.set(peep.id, g);
      }
      g.clear();
      g.beginFill(ACTIVITY_COLORS[peep.activity] ?? 0xffffff);
      g.drawCircle(0, 0, TILE_SIZE * 0.35);
      g.endFill();
      g.x = peep.x * TILE_SIZE + TILE_SIZE / 2;
      g.y = peep.y * TILE_SIZE + TILE_SIZE / 2;
      g.alpha = peep.alive ? 1 : 0.2;
    }

    // Remove sprites for peeps that no longer exist in this snapshot.
    for (const [id, g] of sprites) {
      if (!seen.has(id)) {
        app.stage.removeChild(g);
        g.destroy();
        sprites.delete(id);
      }
    }
  }, [peeps, onSelect]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}
