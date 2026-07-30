/**
 * One projection of a run's artifacts that every visualize-composition
 * metric reads.
 *
 * The metrics all ask questions about the same handful of things - when
 * the user asked, when a visual appeared, what the model thought before
 * it committed to the tool call, whether the markup was rejected - so
 * `assistant-events.json` is parsed once, here, and the scorers stay
 * thin enough to read as definitions.
 *
 * ## What the artifacts carry
 *
 * `assistant-events.json` is the Vellum daemon's SSE envelope stream
 * verbatim (`vellum events --json` re-serializes the envelope without
 * touching it), with exactly one transformation applied by the adapter:
 * `normalizeVellumEventStream` in `src/lib/adapters/vellum.ts` blanks
 * `text`/`chunk` on every event that is not assistant transcript. It
 * does not touch `thinking`, `toolName`, `input`, `result`, `isError`,
 * `surfaceType`, `toolUseId`, or the envelope's `emittedAt`, so every
 * field this module reads survives to disk.
 *
 * Token usage is deliberately absent here. The daemon's usage events
 * (`usage_update` / `usage_progress`) carry flat token fields rather
 * than the `message.usage` record `summarizeAssistantUsage` looks for,
 * and the harness's authoritative usage comes from the egress jail's
 * recorded model traffic instead - which is per-HTTP-request, not
 * attributable to a thinking span. Reasoning volume is therefore
 * measured in characters, not tokens.
 */
import type { AgentEvent } from "../../../../src/lib/adapter";
import {
  readAssistantEvents,
  readTranscript,
} from "../../../../src/lib/metrics";

/** The `ui_show` surface type this benchmark is about. */
export const VISUAL_SURFACE_TYPE = "visual";

/** Tool name the daemon reports for the surface-rendering tool. */
export const UI_SHOW_TOOL = "ui_show";

/** Tool name the daemon reports when the agent loads a skill. */
export const SKILL_LOAD_TOOL = "skill_load";

export interface TimedEvent {
  /** Epoch ms, or `undefined` when the event carried no usable stamp. */
  at?: number;
}

export interface UiShowCall extends TimedEvent {
  toolUseId?: string;
  input?: Record<string, unknown>;
  /**
   * `surface_type` read off the tool input. `undefined` only when the
   * input was withheld, in which case callers must not assume the call
   * was non-visual.
   */
  surfaceType?: string;
  /** Whether the matching `tool_result` reported an error. */
  isError?: boolean;
  /** The matching `tool_result` payload, when one arrived. */
  result?: string;
  /** When the matching `tool_result` arrived, in epoch ms. */
  resolvedAt?: number;
}

export interface VisualRunView {
  /**
   * When the user's question reached the assistant, in epoch ms. Taken
   * from the first `simulator` transcript turn - the runner stamps that
   * turn immediately before `agent.send()`.
   */
  askedAt?: number;
  /**
   * `ui_surface_pending` events. The daemon emits one the moment it
   * sniffs `"surface_type": "visual"` in the streaming tool input, so
   * this is the earliest observable "a visual is being composed into
   * the tool call" signal - and its presence without a matching
   * surface is the fingerprint of a turn that died mid-fragment.
   */
  pendingVisuals: Array<TimedEvent & { toolUseId?: string }>;
  /** Every `ui_surface_show` whose `surfaceType` is `visual`, in order. */
  visualSurfaces: Array<TimedEvent & { toolCallId?: string }>;
  /** Every `ui_show` tool call, in start order, with its result folded in. */
  uiShowCalls: UiShowCall[];
  /** Every `skill_load` tool call, in start order, with the skill asked for. */
  skillLoads: Array<TimedEvent & { skill?: string; resolvedAt?: number }>;
  /** Every thinking delta the assistant emitted, in order. */
  thinkingDeltas: Array<TimedEvent & { thinking: string }>;
}

function parseIso(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function epochField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Best available timestamp for an event. The envelope's ISO `emittedAt`
 * is stamped on every event the daemon builds, so it is the primary;
 * the payload-level epoch stamps (`timestampMs` on thinking deltas,
 * `startedAt` on tool starts, `completedAt` on tool results) are the
 * fallback for a stream produced by an older daemon.
 */
function eventAt(event: AgentEvent): number | undefined {
  return (
    parseIso(event.emittedAt) ??
    epochField(event.message.timestampMs) ??
    epochField(event.message.startedAt) ??
    epochField(event.message.completedAt)
  );
}

/**
 * `surface_type` as the `ui_show` tool declares it. Read from both the
 * snake_case wire name and a camelCase spelling so a schema rename on
 * the assistant side degrades to "unknown" rather than to "not visual".
 */
function readSurfaceType(
  input: Record<string, unknown> | undefined,
): string | undefined {
  if (!input) return undefined;
  return stringField(input.surface_type) ?? stringField(input.surfaceType);
}

/**
 * Fold a run's events into the shape the metrics ask questions of.
 *
 * `tool_result` carries its own `toolName`, so results are matched to
 * `ui_show` by name first and then to a specific call by `toolUseId` -
 * falling back to the oldest unresolved `ui_show` call when the result
 * omits the id.
 */
export async function readVisualRun(runId: string): Promise<VisualRunView> {
  const [turns, events] = await Promise.all([
    readTranscript(runId),
    readAssistantEvents(runId),
  ]);

  const askedAt = turns
    .filter((turn) => turn.role === "simulator")
    .map((turn) => Date.parse(turn.emittedAt))
    .filter((ms) => !Number.isNaN(ms))
    .sort((a, b) => a - b)[0];

  const view: VisualRunView = {
    askedAt,
    pendingVisuals: [],
    visualSurfaces: [],
    uiShowCalls: [],
    skillLoads: [],
    thinkingDeltas: [],
  };

  for (const event of events) {
    const msg = event.message;
    const at = eventAt(event);

    switch (msg.type) {
      case "assistant_thinking_delta": {
        const thinking = stringField(msg.thinking);
        if (thinking) view.thinkingDeltas.push({ at, thinking });
        break;
      }
      case "ui_surface_pending": {
        if (stringField(msg.surfaceType) === VISUAL_SURFACE_TYPE) {
          view.pendingVisuals.push({
            at,
            toolUseId: stringField(msg.toolUseId),
          });
        }
        break;
      }
      case "ui_surface_show": {
        if (stringField(msg.surfaceType) === VISUAL_SURFACE_TYPE) {
          view.visualSurfaces.push({
            at,
            toolCallId: stringField(msg.toolCallId),
          });
        }
        break;
      }
      case "tool_use_start": {
        const toolName = stringField(msg.toolName);
        if (toolName === UI_SHOW_TOOL) {
          view.uiShowCalls.push({
            at,
            toolUseId: stringField(msg.toolUseId),
            input: msg.input,
            surfaceType: readSurfaceType(msg.input),
          });
        } else if (toolName === SKILL_LOAD_TOOL) {
          view.skillLoads.push({
            at,
            skill: stringField(msg.input?.skill),
          });
        }
        break;
      }
      case "tool_result": {
        const toolName = stringField(msg.toolName);
        const toolUseId = stringField(msg.toolUseId);
        if (toolName === SKILL_LOAD_TOOL) {
          const skillLoad = view.skillLoads.find(
            (load) => load.resolvedAt === undefined,
          );
          if (skillLoad) skillLoad.resolvedAt = at;
          break;
        }
        if (toolName !== UI_SHOW_TOOL) break;
        const target = view.uiShowCalls.find(
          (call) =>
            call.resolvedAt === undefined &&
            (toolUseId === undefined || call.toolUseId === toolUseId),
        );
        if (!target) break;
        target.isError = typeof msg.isError === "boolean" ? msg.isError : false;
        target.result = stringField(msg.result);
        target.resolvedAt = at;
        break;
      }
      default:
        break;
    }
  }

  return view;
}

/**
 * The `ui_show` calls that were plausibly visual: the ones that say so,
 * plus the ones whose input never reached us. A call we cannot classify
 * counts as visual on purpose - under-counting attempts would flatter a
 * profile whose tool inputs happen not to be captured.
 */
export function visualUiShowCalls(view: VisualRunView): UiShowCall[] {
  return view.uiShowCalls.filter(
    (call) =>
      call.surfaceType === undefined ||
      call.surfaceType === VISUAL_SURFACE_TYPE,
  );
}

/**
 * When the first visual reached the client, in epoch ms.
 *
 * Prefers `ui_surface_show`, which is the daemon reporting a delivered
 * surface. Falls back to the first `ui_show` call that came back
 * without an error, so a build whose surface event is spelled
 * differently still measures something real rather than scoring every
 * profile zero.
 */
export function firstVisualAt(view: VisualRunView): number | undefined {
  const surfaceAt = view.visualSurfaces
    .map((surface) => surface.at)
    .find((at): at is number => at !== undefined);
  if (surfaceAt !== undefined) return surfaceAt;
  return visualUiShowCalls(view)
    .filter((call) => call.isError === false)
    .map((call) => call.resolvedAt ?? call.at)
    .find((at): at is number => at !== undefined);
}

/** True when the run put a visual on screen by either signal. */
export function showedVisual(view: VisualRunView): boolean {
  if (view.visualSurfaces.length > 0) return true;
  return visualUiShowCalls(view).some((call) => call.isError === false);
}

/**
 * All thinking the assistant emitted, concatenated in stream order.
 * Deltas are fragments of one reasoning block, so they join with no
 * separator - the same coalescing `src/lib/transcript-view.ts` applies.
 */
export function allThinking(view: VisualRunView): string {
  return view.thinkingDeltas.map((delta) => delta.thinking).join("");
}

/**
 * Thinking emitted before the model committed to its first `ui_show`
 * call, concatenated in stream order.
 *
 * The window opens at the `skill_load` result when the run loaded a
 * skill (the reasoning that matters is what happens *after* the skill's
 * instructions land) and at the user's question otherwise. It closes at
 * the first `ui_show` `tool_use_start`.
 *
 * Returns the whole run's thinking when the window cannot be bounded -
 * no `ui_show` call was made, or the events carry no usable stamps.
 */
export function thinkingBeforeFirstUiShow(view: VisualRunView): {
  thinking: string;
  attributed: boolean;
} {
  const firstUiShowAt = view.uiShowCalls
    .map((call) => call.at)
    .find((at): at is number => at !== undefined);
  if (firstUiShowAt === undefined) {
    return { thinking: allThinking(view), attributed: false };
  }
  const start =
    view.skillLoads
      .map((load) => load.resolvedAt)
      .find((at): at is number => at !== undefined) ??
    view.askedAt ??
    Number.NEGATIVE_INFINITY;

  const windowed = view.thinkingDeltas.filter(
    (delta) =>
      delta.at !== undefined && delta.at >= start && delta.at <= firstUiShowAt,
  );
  // Every delta lacking a stamp would silently vanish from the window;
  // fall back to the whole run rather than under-report the burn.
  if (windowed.length === 0 && view.thinkingDeltas.length > 0) {
    return { thinking: allThinking(view), attributed: false };
  }
  return {
    thinking: windowed.map((delta) => delta.thinking).join(""),
    attributed: true,
  };
}
