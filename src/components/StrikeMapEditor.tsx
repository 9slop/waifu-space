import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  StrikeMapEditorController,
  COMPONENT_PARAM_SPECS,
  EditorSelectionInfo,
  EditorLightInfo,
  EditorSpawnInfo,
  EditorSelectionKind,
  TerrainTool
} from '../lib/strike/map/editor/editor-scene';
import { COMPONENTS } from '../lib/strike/map/components/registry';
import '../styles/editor.css';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function Field(props: {
  label: string;
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label class="edi-field">
      <span class="edi-field-label">{props.label}</span>
      <input
        type="number"
        step={props.step ?? 0.5}
        value={props.value.toFixed(3)}
        disabled={props.disabled}
        onChange={(e) => props.onChange(parseFloat(e.currentTarget.value) || 0)}
      />
    </label>
  );
}

function CheckRow(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label class="edi-check-row">
      <span>{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
    </label>
  );
}

export function StrikeMapEditor(props: { onExit?: () => void }) {
  let containerRef!: HTMLDivElement;
  let canvasRef!: HTMLCanvasElement;
  let fileInputRef!: HTMLInputElement;

  let controller: StrikeMapEditorController | null = null;

  const [objects, setObjects] = createSignal<ReturnType<StrikeMapEditorController['getObjectList']>>([]);
  const [lights, setLights] = createSignal<ReturnType<StrikeMapEditorController['getLightList']>>([]);
  const [spawns, setSpawns] = createSignal<ReturnType<StrikeMapEditorController['getSpawnList']>>([]);
  const [objectSel, setObjectSel] = createSignal<EditorSelectionInfo | null>(null);
  const [lightSel, setLightSel] = createSignal<EditorLightInfo | null>(null);
  const [spawnSel, setSpawnSel] = createSignal<EditorSpawnInfo | null>(null);
  const [selKind, setSelKind] = createSignal<EditorSelectionKind>('none');
  const [dirty, setDirty] = createSignal(false);
  const [gizmoMode, setGizmoMode] = createSignal<'translate' | 'rotate' | 'scale'>('translate');
  const [snap, setSnap] = createSignal(true);
  const [snapStep, setSnapStep] = createSignal(0.5);
  const [snapToGround, setSnapToGroundModal] = createSignal(true);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [terrainTool, setTerrainTool] = createSignal<TerrainTool>('none');
  const [brushSize, setBrushSize] = createSignal(8);
  const [brushStrength, setBrushStrength] = createSignal(1);

  const refresh = () => {
    if (!controller) return;
    const kind = controller.getSelectionKind();
    setSelKind(kind);
    setObjects(controller.getObjectList());
    setLights(controller.getLightList());
    setSpawns(controller.getSpawnList());
    setObjectSel(kind === 'object' ? controller.getSelectionInfo() : null);
    setLightSel(kind === 'light' ? controller.getLightSelectionInfo() : null);
    setSpawnSel(kind === 'spawn' ? controller.getSpawnSelectionInfo() : null);
    setDirty(controller.dirty);
  };

  onMount(() => {
    controller = new StrikeMapEditorController(canvasRef, () => {
      queueMicrotask(refresh);
    });

    const handleResize = () => controller?.handleResize();
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    // Wheel over the Babylon canvas drives camera zoom — swallow the event so
    // the document never scrolls underneath while zooming in/out.
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.edi-canvas')) {
        e.preventDefault();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!controller) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      const kind = controller.getSelectionKind();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        controller.undo();
        refresh();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && kind !== 'none') {
        e.preventDefault();
        controller.deleteSelected();
        refresh();
      } else if (mod && key === 'c' && kind !== 'none') {
        e.preventDefault();
        controller.copySelected();
      } else if (mod && key === 'x' && kind !== 'none') {
        e.preventDefault();
        controller.cutSelected();
        refresh();
      } else if (mod && key === 'v') {
        e.preventDefault();
        controller.pasteSelected();
        refresh();
      } else if (mod && key === 'd' && kind !== 'none') {
        e.preventDefault();
        controller.duplicateSelected();
        refresh();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    containerRef.addEventListener('wheel', handleWheel, { passive: false });

    refresh();

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      containerRef.removeEventListener('wheel', handleWheel);
      controller?.dispose();
      controller = null;
    });
  });

  const handleAddBox = () => {
    controller?.addBox();
    refresh();
  };

  const handleAddComponent = (componentId: string) => {
    controller?.addComponent(componentId);
    refresh();
  };

  const handleAddLight = () => {
    controller?.addLight();
    refresh();
  };

  const handleAddSpawn = () => {
    controller?.addSpawn();
    refresh();
  };

  const handleSelectObject = (index: number) => {
    controller?.selectByIndex(index);
    refresh();
  };

  const handleToggleLock = (id: string) => {
    const obj = objects().find((o) => o.id === id);
    if (!obj || !controller) return;
    controller.setLocked(id, !obj.locked);
    refresh();
  };

  const handleSelectLight = (id: string) => {
    controller?.selectById(id);
    refresh();
  };

  const handleSelectSpawn = (index: number) => {
    controller?.selectSpawn(index);
    refresh();
  };

  const handleSetGizmo = (mode: 'translate' | 'rotate' | 'scale') => {
    controller?.setGizmoMode(mode);
    setGizmoMode(mode);
    refresh();
  };

  const handleToggleSnap = () => {
    const next = !snap();
    controller?.setSnap(next);
    setSnap(next);
  };

  const handleSnapStep = (step: number) => {
    controller?.setTranslateSnap(step);
    setSnapStep(step);
    controller?.setSnap(true);
    setSnap(true);
  };

  const handleSetTerrainTool = (tool: TerrainTool) => {
    controller?.setTerrainTool(tool);
    setTerrainTool(tool);
  };

  const handleBrushSize = (size: number) => {
    controller?.setBrushSize(size);
    setBrushSize(size);
  };

  const handleBrushStrength = (strength: number) => {
    controller?.setBrushStrength(strength);
    setBrushStrength(strength);
  };

  const handleToggleSnapToGround = () => {
    const next = !snapToGround();
    controller?.setSnapToGround(next);
    setSnapToGroundModal(next);
  };

  const handleDelete = () => {
    controller?.deleteSelected();
    refresh();
  };

  const handleReset = async () => {
    if (controller?.dirty && !window.confirm('Discard unsaved changes and reset to the default map?')) return;
    controller?.resetToDefault();
    refresh();
  };

  const handleSave = async () => {
    if (!controller) return;
    const json = controller.serialize();

    try {
      const res = await fetch('/api/strike/map-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: json })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        controller.dirty = false;
        setDirty(false);
      } else {
        window.alert(`Repo save failed: ${data?.error || res.status}`);
      }
    } catch {
      window.alert('Repo save failed (network error)');
    }

    // Always offer a manual download of the wsmap file too.
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kyoto.wsmap';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      /* download is best-effort */
    }
  };

  const handleOpen = (file: File | null) => {
    if (!file || !controller) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = controller!.importJSON(String(reader.result ?? ''));
      if (result.ok) {
        refresh();
      } else {
        window.alert(`Open failed: ${result.error}`);
      }
    };
    reader.readAsText(file);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      } else {
        await containerRef?.requestFullscreen?.();
        setIsFullscreen(true);
      }
    } catch (err) {
      window.alert('Fullscreen is not available here');
    }
    // Let the browser settle before resizing the engine.
    setTimeout(() => controller?.handleResize(), 100);
  };

  const patchLight = (
    partial: {
      position?: [number, number, number];
      color?: [number, number, number];
      intensity?: number;
      range?: number;
    }
  ) => {
    const l = lightSel();
    if (!l || !controller) return;
    controller.updateLightById(l.id, partial);
    refresh();
  };

  const patchSpawn = (partial: { position?: [number, number, number]; yaw?: number }) => {
    const s = spawnSel();
    if (!s || !controller) return;
    controller.updateSpawn(s.index, partial);
    refresh();
  };

  const selectedName = () => {
    if (selKind() === 'light') return lightSel()?.name;
    if (selKind() === 'spawn') return `Spawn ${(spawnSel()?.index ?? 0) + 1}`;
    return objectSel()?.name;
  };
  const selectedHint = () => {
    if (selKind() === 'light') return lightSel()?.id;
    if (selKind() === 'spawn') return spawnSel() ? `Team ${spawnSel()!.team}` : undefined;
    return objectSel()?.id;
  };

  return (
    <div ref={containerRef} class="map-editor" role="region" aria-label="Waifu Strike Map Editor">
      {/* ── Top toolbar ── */}
      <div class="edi-toolbar">
        <div class="edi-brand">
          <span class="edi-logo">🗺️</span>
          <span class="edi-title">Waifu Strike Map Editor</span>
          <Show when={dirty()}><span class="edi-dirty-dot" title="Unsaved changes">●</span></Show>
        </div>
        <div class="edi-toolbar-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wsmap,application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => handleOpen(e.currentTarget.files?.[0] ?? null)}
          />
          <button class="edi-btn" onClick={() => fileInputRef?.click()}>Open .wsmap</button>
          <button class="edi-btn" onClick={handleReset}>Reset Default</button>
          <button class="edi-btn edi-btn-save" onClick={handleSave}>Save (repo + download)</button>
          <button class="edi-btn edi-btn-fullscreen" onClick={toggleFullscreen}>
            {isFullscreen() ? '✕ Exit fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
        <Show when={props.onExit}>
          <button class="edi-btn" onClick={props.onExit}>Exit</button>
        </Show>
      </div>

      {/* ── Main body ── */}
      <div class="edi-body">
        {/* Left: spawns + lights + object list */}
        <aside class="edi-panel edi-left">
          <section class="edi-list-section">
            <header class="edi-panel-head">
              <span>Spawns ({spawns().length})</span>
              <div class="edi-head-actions">
                <button class="edi-icon-btn edi-icon-add" title="Add spawn point" onClick={handleAddSpawn}>＋</button>
                <button
                  class="edi-icon-btn"
                  title="Delete selected"
                  disabled={selKind() === 'none'}
                  onClick={handleDelete}
                >🗑</button>
              </div>
            </header>
            <div class="edi-list edi-list-tight">
              <For each={spawns()}>
                {(sp) => (
                  <div
                    class={`edi-list-item edi-list-spawn ${spawnSel()?.index === sp.index ? 'active' : ''}`}
                    onClick={() => handleSelectSpawn(sp.index)}
                  >
                    <span class={`edi-spawn-disc edi-team-${sp.team.toLowerCase()}`}>{sp.team}</span>
                    <span class="edi-list-name">Spawn {sp.index + 1}</span>
                    <span class="edi-list-id">{sp.team === 'A' ? 'south' : 'north'}</span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <section class="edi-list-section">
            <header class="edi-panel-head">
              <span>Lights ({lights().length})</span>
              <button class="edi-icon-btn edi-icon-add" title="Add point light" onClick={handleAddLight}>＋</button>
            </header>
            <div class="edi-list edi-list-tight">
              <For each={lights()}>
                {(l) => (
                  <div
                    class={`edi-list-item edi-list-light ${lightSel()?.id === l.id ? 'active' : ''}`}
                    onClick={() => handleSelectLight(l.id)}
                  >
                    <span class="edi-kind-badge">☀</span>
                    <span class="edi-list-name">{l.name}</span>
                    <span class="edi-list-id">{l.id}</span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <section class="edi-list-section edi-list-section-grow">
            <header class="edi-panel-head">
              <span>Objects ({objects().length})</span>
            </header>
            <div class="edi-list">
              <Show
                when={objects().length > 0}
                fallback={<div class="edi-empty-state">No objects — use the palette below.</div>}
              >
                <For each={objects()}>
                  {(obj, i) => (
                    <div
                      class={`edi-list-item ${objectSel()?.id === obj.id ? 'active' : ''} edi-kind-${obj.kind}${obj.locked ? ' locked' : ''}`}
                      onClick={() => handleSelectObject(i())}
                    >
                      <span class="edi-kind-badge">{obj.kind === 'component' ? '◆' : obj.kind === 'ground' ? '▦' : '▢'}</span>
                      <span class="edi-list-name">{obj.name}</span>
                      <span class="edi-list-id">{obj.id}</span>
                      <button
                        class={`edi-lock-btn${obj.locked ? ' on' : ''}`}
                        title={obj.locked ? 'Unlock (editing disabled while locked)' : 'Lock (protect from accidental edits)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLock(obj.id);
                        }}
                      >
                        {obj.locked ? '🔒' : '🔓'}
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </aside>

        {/* Center: 3D viewport */}
        <div class="edi-viewport">
          <canvas ref={canvasRef} class="edi-canvas" tabindex="0" />
          <div class="edi-terrain-toolbar" role="toolbar" aria-label="Terrain tools">
            <button
              class={`edi-btn ${terrainTool() === 'none' ? 'active' : ''}`}
              title="Object editing (select, move, rotate)"
              onClick={() => handleSetTerrainTool('none')}
            >
              Select
            </button>
            <button
              class={`edi-btn ${terrainTool() === 'raise' ? 'active' : ''}`}
              title="Raise terrain — drag on the ground"
              onClick={() => handleSetTerrainTool('raise')}
            >
              Raise
            </button>
            <button
              class={`edi-btn ${terrainTool() === 'lower' ? 'active' : ''}`}
              title="Lower terrain — drag on the ground"
              onClick={() => handleSetTerrainTool('lower')}
            >
              Lower
            </button>
            <button
              class={`edi-btn ${terrainTool() === 'smooth' ? 'active' : ''}`}
              title="Smooth terrain — drag to soften bumps"
              onClick={() => handleSetTerrainTool('smooth')}
            >
              Smooth
            </button>
            <Show when={terrainTool() !== 'none'}>
              <div class="edi-terrain-controls">
                <label class="edi-terrain-slider">
                  <span>Size {brushSize().toFixed(0)}m</span>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    step="1"
                    value={brushSize()}
                    onInput={(e) => handleBrushSize(parseFloat(e.currentTarget.value) || 1)}
                  />
                </label>
                <label class="edi-terrain-slider">
                  <span>Strength {brushStrength().toFixed(2)}</span>
                  <input
                    type="range"
                    min="0.05"
                    max="4"
                    step="0.05"
                    value={brushStrength()}
                    onInput={(e) => handleBrushStrength(parseFloat(e.currentTarget.value) || 0.05)}
                  />
                </label>
              </div>
            </Show>
          </div>
          <div class="edi-hud">
            <Show when={selKind() !== 'none'}>
              <span>{selectedName()} <code>{selectedHint()}</code></span>
            </Show>
            <div class="edi-cam-hint">
              <Show when={terrainTool() !== 'none'} fallback="orbit: LMB · pan: RMB · zoom: wheel · fly: WASD/QE · focus: F · home: reset">
                sculpt: LMB · pan: RMB · zoom: wheel
              </Show>
            </div>
          </div>
        </div>

        {/* Right: inspector + gizmo controls */}
        <aside class="edi-panel edi-right">
          <Show when={selKind() === 'object' && objectSel()}>
            {(_) => {
              const s = objectSel()!;
              return (
                <>
                  <section class="edi-panel-section">
                    <header class="edi-panel-head"><span>Transform</span></header>
                    <Show when={s.locked}>
                      <div class="edi-inspector-row edi-inspector-note">
                        🔒 Locked — can't be selected or edited from the scene. Uncheck to edit.
                      </div>
                    </Show>
                    <div class="edi-inspector-row">
                      <CheckRow
                        label="Locked (protects from accidental edits)"
                        checked={s.locked}
                        onChange={(v) => { controller?.setLocked(s.id, v); refresh(); }}
                      />
                    </div>
                    <div class="edi-field-grid">
                      <span class="edi-axis-hdr">Pos X</span>
                      <span class="edi-axis-hdr">Pos Y</span>
                      <span class="edi-axis-hdr">Pos Z</span>
                      <Field label="X" value={s.position[0]} step={snapStep()} disabled={s.locked} onChange={(v) => { controller?.applyTransform('x', 'position', v); refresh(); }} />
                      <Field label="Y" value={s.position[1]} step={snapStep()} disabled={s.locked} onChange={(v) => { controller?.applyTransform('y', 'position', v); refresh(); }} />
                      <Field label="Z" value={s.position[2]} step={snapStep()} disabled={s.locked} onChange={(v) => { controller?.applyTransform('z', 'position', v); refresh(); }} />
                      <Field label="RX°" value={s.rotation[0] * DEG} step={15} disabled={s.locked} onChange={(v) => { controller?.applyTransform('x', 'rotation', v * RAD); refresh(); }} />
                      <Field label="RY°" value={s.rotation[1] * DEG} step={15} disabled={s.locked} onChange={(v) => { controller?.applyTransform('y', 'rotation', v * RAD); refresh(); }} />
                      <Field label="RZ°" value={s.rotation[2] * DEG} step={15} disabled={s.locked} onChange={(v) => { controller?.applyTransform('z', 'rotation', v * RAD); refresh(); }} />
                      <Show when={s.kind === 'component' && s.scale}>
                        <Field label="SX" value={s.scale![0]} step={0.1} disabled={s.locked} onChange={(v) => { controller?.applyTransform('x', 'scale', v); refresh(); }} />
                        <Field label="SY" value={s.scale![1]} step={0.1} disabled={s.locked} onChange={(v) => { controller?.applyTransform('y', 'scale', v); refresh(); }} />
                        <Field label="SZ" value={s.scale![2]} step={0.1} disabled={s.locked} onChange={(v) => { controller?.applyTransform('z', 'scale', v); refresh(); }} />
                      </Show>
                    </div>

                    <div class="edi-inspector-row">
                      <label class="edi-insp-label">Name</label>
                      <input
                        type="text"
                        value={s.name}
                        disabled={s.locked}
                        onBlur={(e) => { controller?.renameSelected(e.currentTarget.value); refresh(); }}
                      />
                    </div>

                    <Show when={s.kind === 'box' || s.kind === 'ground'}>
                      <div class="edi-inspector-row">
                        <label class="edi-insp-label">Material</label>
                        <select
                          value={s.material}
                          disabled={s.locked}
                          onChange={(e) => { controller?.applyMaterial(e.currentTarget.value); refresh(); }}
                        >
                          <For each={controller?.materialKeys ?? []}>
                            {(key) => <option value={key}>{key}</option>}
                          </For>
                        </select>
                      </div>
                      <div class="edi-inspector-row">
                        <CheckRow
                          label="Collidable"
                          checked={s.collidable}
                          disabled={s.locked}
                          onChange={(v) => { controller?.applyCollidable(v); refresh(); }}
                        />
                      </div>
                    </Show>

                    <Show when={s.kind === 'component'}>
                      <div class="edi-inspector-row">
                        <span class="edi-insp-label">Component</span>
                        <code class="edi-component-chip">{s.component}</code>
                      </div>
                      <For each={Object.entries(COMPONENT_PARAM_SPECS[s.component ?? ''] ?? {})}>
                        {([key, spec]) => {
                          const value = s.params[key];
                          if (spec.type === 'boolean') {
                            return (
                              <div class="edi-inspector-row">
                                <CheckRow
                                  label={spec.label ?? key}
                                  checked={Boolean(value ?? spec.default)}
                                  disabled={s.locked}
                                  onChange={(v) => { controller?.updateComponentParam(key, v); refresh(); }}
                                />
                              </div>
                            );
                          }
                          if (spec.type === 'choice') {
                            return (
                              <div class="edi-inspector-row">
                                <label class="edi-insp-label">{spec.label ?? key}</label>
                                <select
                                  value={String(value ?? spec.default)}
                                  disabled={s.locked}
                                  onChange={(e) => { controller?.updateComponentParam(key, e.currentTarget.value); refresh(); }}
                                >
                                  <For each={spec.choices ?? []}>
                                    {(choice) => <option value={choice}>{choice}</option>}
                                  </For>
                                </select>
                              </div>
                            );
                          }
                          return (
                            <div class="edi-inspector-row">
                              <label class="edi-insp-label">{spec.label ?? key}</label>
                              <input
                                type="number"
                                step={1}
                                value={String(value ?? spec.default)}
                                disabled={s.locked}
                                onChange={(e) => { controller?.updateComponentParam(key, parseFloat(e.currentTarget.value) || 0); refresh(); }}
                              />
                            </div>
                          );
                        }}
                      </For>
                    </Show>
                  </section>
                </>
              );
            }}
          </Show>

          <Show when={selKind() === 'light' && lightSel()}>
            {(_) => {
              const l = lightSel()!;
              return (
                <section class="edi-panel-section">
                  <header class="edi-panel-head"><span>Point Light</span></header>
                  <div class="edi-inspector-row">
                    <label class="edi-insp-label">Name</label>
                    <input
                      type="text"
                      value={l.name}
                      onBlur={(e) => { controller?.renameSelected(e.currentTarget.value); refresh(); }}
                    />
                  </div>
                  <div class="edi-field-grid">
                    <span class="edi-axis-hdr">Pos X</span>
                    <span class="edi-axis-hdr">Pos Y</span>
                    <span class="edi-axis-hdr">Pos Z</span>
                    <Field label="X" value={l.position[0]} step={snapStep()} onChange={(v) => patchLight({ position: [v, l.position[1], l.position[2]] })} />
                    <Field label="Y" value={l.position[1]} step={snapStep()} onChange={(v) => patchLight({ position: [l.position[0], v, l.position[2]] })} />
                    <Field label="Z" value={l.position[2]} step={snapStep()} onChange={(v) => patchLight({ position: [l.position[0], l.position[1], v] })} />
                    <Field label="R" value={l.color[0]} step={0.05} onChange={(v) => patchLight({ color: [v, l.color[1], l.color[2]] })} />
                    <Field label="G" value={l.color[1]} step={0.05} onChange={(v) => patchLight({ color: [l.color[0], v, l.color[2]] })} />
                    <Field label="B" value={l.color[2]} step={0.05} onChange={(v) => patchLight({ color: [l.color[0], l.color[1], v] })} />
                  </div>
                  <div class="edi-inspector-row">
                    <label class="edi-insp-label">Intensity</label>
                    <input
                      type="number"
                      step={0.1}
                      value={l.intensity.toFixed(2)}
                      onChange={(e) => patchLight({ intensity: parseFloat(e.currentTarget.value) || 0 })}
                    />
                  </div>
                  <div class="edi-inspector-row">
                    <label class="edi-insp-label">Range</label>
                    <input
                      type="number"
                      step={1}
                      value={l.range.toFixed(1)}
                      onChange={(e) => patchLight({ range: parseFloat(e.currentTarget.value) || 0 })}
                    />
                  </div>
                  <div class="edi-inspector-row">
                    <button class="edi-btn edi-btn-danger" onClick={() => { controller?.deleteSelected(); refresh(); }}>Delete light</button>
                  </div>
                </section>
              );
            }}
          </Show>

          <Show when={selKind() === 'spawn' && spawnSel()}>
            {(_) => {
              const s = spawnSel()!;
              return (
                <section class="edi-panel-section">
                  <header class="edi-panel-head"><span>Spawn Point {s.index + 1}</span></header>
                  <div class="edi-inspector-row">
                    <span class="edi-insp-label">Team</span>
                    <code class={`edi-team-chip edi-team-${s.team.toLowerCase()}`}>{s.team} · {s.team === 'A' ? 'south' : 'north'}</code>
                  </div>
                  <div class="edi-field-grid">
                    <span class="edi-axis-hdr">Pos X</span>
                    <span class="edi-axis-hdr">Pos Y</span>
                    <span class="edi-axis-hdr">Pos Z</span>
                    <Field label="X" value={s.position[0]} step={snapStep()} onChange={(v) => patchSpawn({ position: [v, s.position[1], s.position[2]] })} />
                    <Field label="Y" value={s.position[1]} step={snapStep()} onChange={(v) => patchSpawn({ position: [s.position[0], v, s.position[2]] })} />
                    <Field label="Z" value={s.position[2]} step={snapStep()} onChange={(v) => patchSpawn({ position: [s.position[0], s.position[1], v] })} />
                  </div>
                  <div class="edi-inspector-row">
                    <label class="edi-insp-label">Yaw °</label>
                    <input
                      type="number"
                      step={15}
                      value={(s.yaw * DEG).toFixed(0)}
                      onChange={(e) => patchSpawn({ yaw: (parseFloat(e.currentTarget.value) || 0) * RAD })}
                    />
                  </div>
                  <div class="edi-inspector-row edi-inspector-note">
                    Select the Rotate gizmo to re-aim the spawn arrow.
                  </div>
                  <div class="edi-inspector-row">
                    <button
                      class="edi-btn edi-btn-danger"
                      disabled={spawns().length <= 1}
                      onClick={() => { controller?.deleteSelected(); refresh(); }}
                    >Delete spawn</button>
                  </div>
                </section>
              );
            }}
          </Show>

          <Show when={selKind() === 'none'}>
            <div class="edi-empty-state">
              Nothing selected.<br />Click an object, light or spawn in the scene or in the lists.
            </div>
          </Show>

          <section class="edi-panel-section">
            <header class="edi-panel-head"><span>Gizmo</span></header>
            <div class="edi-gizmo-row">
              <button class={`edi-btn ${gizmoMode() === 'translate' ? 'active' : ''}`} disabled={selKind() === 'object' && !!objectSel()?.locked} onClick={() => handleSetGizmo('translate')}>Move</button>
              <Show when={selKind() !== 'light'}>
                <button class={`edi-btn ${gizmoMode() === 'rotate' ? 'active' : ''}`} disabled={selKind() === 'object' && !!objectSel()?.locked} onClick={() => handleSetGizmo('rotate')}>Rotate</button>
              </Show>
              <Show when={selKind() === 'object' && objectSel()?.kind === 'component'}>
                <button class={`edi-btn ${gizmoMode() === 'scale' ? 'active' : ''}`} disabled={selKind() === 'object' && !!objectSel()?.locked} onClick={() => handleSetGizmo('scale')}>Scale</button>
              </Show>
            </div>
            <div class="edi-gizmo-row">
              <button class="edi-btn" onClick={() => { controller?.frameSelected(); refresh(); }}>Focus (F)</button>
            </div>
            <div class="edi-inspector-row">
              <CheckRow label="Snap to grid" checked={snap()} onChange={handleToggleSnap} />
            </div>
            <div class="edi-inspector-row">
              <CheckRow label="Snap to ground" checked={snapToGround()} onChange={handleToggleSnapToGround} />
            </div>
            <div class="edi-snap-steps">
              <button class={`edi-btn ${snapStep() === 0.25 ? 'active' : ''}`} onClick={() => handleSnapStep(0.25)}>0.25</button>
              <button class={`edi-btn ${snapStep() === 0.5 ? 'active' : ''}`} onClick={() => handleSnapStep(0.5)}>0.5</button>
              <button class={`edi-btn ${snapStep() === 1 ? 'active' : ''}`} onClick={() => handleSnapStep(1)}>1</button>
              <button class={`edi-btn ${snapStep() === 2 ? 'active' : ''}`} onClick={() => handleSnapStep(2)}>2</button>
            </div>
          </section>
        </aside>
      </div>

      {/* ── Bottom palette ── */}
      <div class="edi-palette">
        <div class="edi-palette-group">
          <span class="edi-palette-label">Primitives</span>
          <button class="edi-palette-item" onClick={handleAddBox}>
            <span class="edi-palette-icon">▢</span>
            <span>Box</span>
          </button>
          <button class="edi-palette-item" onClick={handleAddLight}>
            <span class="edi-palette-icon">☀</span>
            <span>Light</span>
          </button>
          <button class="edi-palette-item" onClick={handleAddSpawn}>
            <span class="edi-palette-icon">⬢</span>
            <span>Spawn</span>
          </button>
        </div>
        <div class="edi-palette-group">
          <span class="edi-palette-label">Components</span>
          <For each={COMPONENTS}>
            {(comp) => (
              <button class="edi-palette-item" onClick={() => handleAddComponent(comp.id)} title={comp.hint}>
                <span class="edi-palette-icon">◆</span>
                <span>{comp.label}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}