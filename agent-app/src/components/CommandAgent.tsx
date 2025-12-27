"use client";

import { useMemo, useRef, useState } from "react";

type Heading = "north" | "east" | "south" | "west";

type AgentState = {
  x: number;
  y: number;
  heading: Heading;
  energy: number;
  inventory: string[];
  notes: string[];
};

type CommandLog = {
  id: string;
  userCommand: string;
  agentResponse: string;
  stateAfter: AgentState;
  timestamp: number;
};

const GRID_SIZE = 7;

const headingOrder: Heading[] = ["north", "east", "south", "west"];

function nextHeading(current: Heading, direction: "left" | "right"): Heading {
  const index = headingOrder.indexOf(current);
  const offset = direction === "left" ? -1 : 1;
  const nextIndex = (index + offset + headingOrder.length) % headingOrder.length;
  return headingOrder[nextIndex];
}

function moveForward({ x, y, heading }: AgentState) {
  switch (heading) {
    case "north":
      return { x, y: Math.min(GRID_SIZE - 1, y + 1) };
    case "south":
      return { x, y: Math.max(0, y - 1) };
    case "east":
      return { x: Math.min(GRID_SIZE - 1, x + 1), y };
    case "west":
      return { x: Math.max(0, x - 1), y };
  }
}

const baseState: AgentState = {
  x: Math.floor(GRID_SIZE / 2),
  y: Math.floor(GRID_SIZE / 2),
  heading: "north",
  energy: 80,
  inventory: [],
  notes: ["Calibrated and ready."],
};

const createId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function clampEnergy(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatState(state: AgentState) {
  return `Position (${state.x}, ${state.y}) · Heading ${state.heading.toUpperCase()} · Energy ${state.energy}%`;
}

type CommandResult = {
  response: string;
  nextState: AgentState;
};

function interpretCommand(input: string, current: AgentState): CommandResult {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return {
      response: "Awaiting directives. Try something like “move north” or “scan perimeter”.",
      nextState: current,
    };
  }

  if (["help", "commands", "manual"].includes(normalized)) {
    return {
      response:
        "Available directives: move <north|south|east|west|forward>, turn <left|right|around>, scan, rest, status, reset, collect <item>, drop <item>, note <text>, energy <value>, path <x,y>. All commands are case-insensitive.",
      nextState: current,
    };
  }

  if (["status", "report", "state"].includes(normalized)) {
    return {
      response: formatState(current),
      nextState: current,
    };
  }

  if (normalized.startsWith("note ")) {
    const message = input.slice(input.toLowerCase().indexOf("note") + 4).trim();
    if (!message) {
      return {
        response: "Please provide note content after the command (e.g. “note secure perimeter”).",
        nextState: current,
      };
    }
    return {
      response: `Noted: ${message}`,
      nextState: {
        ...current,
        notes: [...current.notes, message],
      },
    };
  }

  if (normalized.startsWith("collect ")) {
    const item = input.slice(input.toLowerCase().indexOf("collect") + 7).trim();
    if (!item) {
      return {
        response: "Specify what to collect (e.g. “collect sample”).",
        nextState: current,
      };
    }
    if (current.inventory.includes(item)) {
      return {
        response: `Item "${item}" is already secured.`,
        nextState: current,
      };
    }
    return {
      response: `Collected "${item}" and stored in inventory.`,
      nextState: {
        ...current,
        inventory: [...current.inventory, item],
      },
    };
  }

  if (normalized.startsWith("drop ")) {
    const item = input.slice(input.toLowerCase().indexOf("drop") + 4).trim();
    if (!item) {
      return {
        response: "Specify what to drop (e.g. “drop sample”).",
        nextState: current,
      };
    }
    if (!current.inventory.includes(item)) {
      return {
        response: `Inventory does not contain "${item}".`,
        nextState: current,
      };
    }
    return {
      response: `Released "${item}" from inventory.`,
      nextState: {
        ...current,
        inventory: current.inventory.filter((entry) => entry !== item),
      },
    };
  }

  if (normalized.startsWith("energy ")) {
    const value = Number.parseInt(normalized.replace("energy", "").trim(), 10);
    if (Number.isNaN(value)) {
      return {
        response: "Provide an energy value between 0 and 100 (e.g. “energy 65”).",
        nextState: current,
      };
    }
    return {
      response: `Energy recalibrated to ${clampEnergy(value)}%.`,
      nextState: {
        ...current,
        energy: clampEnergy(value),
      },
    };
  }

  if (normalized.startsWith("path ")) {
    const coords = normalized.replace("path", "").trim().split(",");
    if (coords.length !== 2) {
      return {
        response: "Use “path x,y” to teleport the agent within the grid.",
        nextState: current,
      };
    }
    const targetX = Number.parseInt(coords[0].trim(), 10);
    const targetY = Number.parseInt(coords[1].trim(), 10);
    if (
      Number.isNaN(targetX) ||
      Number.isNaN(targetY) ||
      targetX < 0 ||
      targetY < 0 ||
      targetX >= GRID_SIZE ||
      targetY >= GRID_SIZE
    ) {
      return {
        response: `Coordinates out of bounds. The grid is ${GRID_SIZE}×${GRID_SIZE}, indexed from (0,0).`,
        nextState: current,
      };
    }
    return {
      response: `Navigated directly to (${targetX}, ${targetY}).`,
      nextState: {
        ...current,
        x: targetX,
        y: targetY,
        energy: clampEnergy(current.energy - 10),
      },
    };
  }

  if (["reset", "reboot", "init"].includes(normalized)) {
    return {
      response: "Agent reset to baseline configuration.",
      nextState: baseState,
    };
  }

  if (["rest", "recover", "recharge"].includes(normalized)) {
    const restored = clampEnergy(current.energy + 15);
    return {
      response: `Resting... Energy now at ${restored}%.`,
      nextState: { ...current, energy: restored },
    };
  }

  if (["scan", "scan area", "scan perimeter", "analyze"].includes(normalized)) {
    const report = `Scan complete. No threats detected. Notes: ${
      current.notes.length ? current.notes.slice(-1)[0] : "No mission notes."
    }`;
    return {
      response: report,
      nextState: { ...current, energy: clampEnergy(current.energy - 5) },
    };
  }

  if (normalized.startsWith("turn ")) {
    if (normalized.includes("left")) {
      return {
        response: `Turned left. Heading ${nextHeading(current.heading, "left").toUpperCase()}.`,
        nextState: {
          ...current,
          heading: nextHeading(current.heading, "left"),
          energy: clampEnergy(current.energy - 2),
        },
      };
    }
    if (normalized.includes("right")) {
      return {
        response: `Turned right. Heading ${nextHeading(current.heading, "right").toUpperCase()}.`,
        nextState: {
          ...current,
          heading: nextHeading(current.heading, "right"),
          energy: clampEnergy(current.energy - 2),
        },
      };
    }
    if (normalized.includes("around")) {
      const halfway = nextHeading(current.heading, "right");
      return {
        response: `Executed 180° pivot. Heading ${nextHeading(halfway, "right").toUpperCase()}.`,
        nextState: {
          ...current,
          heading: nextHeading(nextHeading(current.heading, "right"), "right"),
          energy: clampEnergy(current.energy - 3),
        },
      };
    }
    return {
      response: "Specify turn direction: left, right, or around.",
      nextState: current,
    };
  }

  if (normalized.startsWith("move") || normalized.includes("forward")) {
    if (normalized.includes("north")) {
      const nextPosition = { ...current, heading: "north", ...moveForward({ ...current, heading: "north" }) };
      return {
        response: `Advanced north to (${nextPosition.x}, ${nextPosition.y}).`,
        nextState: {
          ...current,
          x: nextPosition.x,
          y: nextPosition.y,
          heading: "north",
          energy: clampEnergy(current.energy - 6),
        },
      };
    }
    if (normalized.includes("south")) {
      const nextPosition = { ...current, heading: "south", ...moveForward({ ...current, heading: "south" }) };
      return {
        response: `Advanced south to (${nextPosition.x}, ${nextPosition.y}).`,
        nextState: {
          ...current,
          x: nextPosition.x,
          y: nextPosition.y,
          heading: "south",
          energy: clampEnergy(current.energy - 6),
        },
      };
    }
    if (normalized.includes("east")) {
      const nextPosition = { ...current, heading: "east", ...moveForward({ ...current, heading: "east" }) };
      return {
        response: `Advanced east to (${nextPosition.x}, ${nextPosition.y}).`,
        nextState: {
          ...current,
          x: nextPosition.x,
          y: nextPosition.y,
          heading: "east",
          energy: clampEnergy(current.energy - 6),
        },
      };
    }
    if (normalized.includes("west")) {
      const nextPosition = { ...current, heading: "west", ...moveForward({ ...current, heading: "west" }) };
      return {
        response: `Advanced west to (${nextPosition.x}, ${nextPosition.y}).`,
        nextState: {
          ...current,
          x: nextPosition.x,
          y: nextPosition.y,
          heading: "west",
          energy: clampEnergy(current.energy - 6),
        },
      };
    }
    const nextCoords = moveForward(current);
    if (nextCoords.x === current.x && nextCoords.y === current.y) {
      return {
        response: "Boundary reached. Unable to move further forward.",
        nextState: current,
      };
    }
    return {
      response: `Advanced forward to (${nextCoords.x}, ${nextCoords.y}).`,
      nextState: {
        ...current,
        ...nextCoords,
        energy: clampEnergy(current.energy - 6),
      },
    };
  }

  return {
    response:
      "Command not recognized. Request “help” to review supported directives or provide a more specific instruction.",
    nextState: current,
  };
}

export function CommandAgent() {
  const [command, setCommand] = useState("");
  const [agentState, setAgentState] = useState(baseState);
  const [history, setHistory] = useState<CommandLog[]>(() => [
    {
      id: createId(),
      userCommand: "system boot",
      agentResponse: "Agent online. Ready for directives.",
      stateAfter: baseState,
      timestamp: Date.now(),
    },
  ]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const inventoryLabel = useMemo(
    () => (agentState.inventory.length ? agentState.inventory.join(", ") : "Empty"),
    [agentState.inventory],
  );

  const notesPreview = useMemo(() => {
    if (!agentState.notes.length) {
      return "No mission notes recorded yet.";
    }
    const noteStartIndex = Math.max(0, agentState.notes.length - 3);
    return agentState.notes
      .slice(-3)
      .map((entry, index) => `${noteStartIndex + index + 1}. ${entry}`)
      .join("\n");
  }, [agentState.notes]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentCommand = command;
    if (!currentCommand.trim()) {
      setCommand("");
      return;
    }

    const { response, nextState } = interpretCommand(currentCommand, agentState);

    const entry: CommandLog = {
      id: createId(),
      userCommand: currentCommand,
      agentResponse: response,
      stateAfter: nextState,
      timestamp: Date.now(),
    };

    setHistory((logs) => [...logs, entry]);
    setAgentState(nextState);
    setCommand("");

    queueMicrotask(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Command Agent
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Issue natural-language directives. The agent updates its status in real time across the mission dashboard.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <span>Command Stream</span>
            <span>{history.length} entries</span>
          </div>
          <div
            ref={logContainerRef}
            className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-6 py-6 text-sm text-slate-700 dark:text-slate-300"
          >
            {history.map((entry) => (
              <div key={entry.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>USER</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  {entry.userCommand}
                </p>
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-emerald-500">
                  <span>AGENT</span>
                  <span>{formatState(entry.stateAfter)}</span>
                </div>
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-slate-700 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {entry.agentResponse}
                </p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <label htmlFor="command" className="sr-only">
              Command input
            </label>
            <div className="flex items-center gap-3">
              <input
                id="command"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="e.g. Move north two steps and scan perimeter"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/20"
                autoComplete="off"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Execute
              </button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Mission Overview</h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Energy {agentState.energy.toString().padStart(2, "0")}%
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Coordinates</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {agentState.x}, {agentState.y}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Heading</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {agentState.heading.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Inventory</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{agentState.inventory.length}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-slate-400">Inventory Contents</p>
              <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {inventoryLabel}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-slate-400">Recent Notes</p>
              <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {notesPreview}
              </pre>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tactical Map</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              The grid expands {GRID_SIZE}×{GRID_SIZE}. Agent origin is centered.
            </p>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {Array.from({ length: GRID_SIZE })
                .map((_, rowIndex) => GRID_SIZE - 1 - rowIndex)
                .map((row) =>
                  Array.from({ length: GRID_SIZE }, (_, column) => {
                    const isAgent = agentState.x === column && agentState.y === row;
                    return (
                      <div
                        key={`${row}-${column}`}
                        className={`flex aspect-square items-center justify-center rounded-md border text-xs font-semibold ${
                          isAgent
                            ? "border-emerald-500 bg-emerald-500/90 text-white shadow-lg"
                            : "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {isAgent ? agentState.heading.slice(0, 1).toUpperCase() : `${column},${row}`}
                      </div>
                    );
                  }),
                )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-sm text-slate-200 shadow-sm dark:border-slate-700">
            <h2 className="text-base font-semibold text-white">Quick Commands</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="font-semibold text-emerald-300">Navigation:</span> move north | move west | turn right
              </li>
              <li>
                <span className="font-semibold text-emerald-300">Logistics:</span> collect sample | drop sample | note
                mission secure
              </li>
              <li>
                <span className="font-semibold text-emerald-300">Systems:</span> scan perimeter | rest | status | reset
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
