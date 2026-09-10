# ADR-0003 · MCP as the transport, with the operation layer transport-agnostic

**Status:** Proposed · **Date:** 2026-07-27 · **Deciders:** platform lead

## Context

Locked decision: MCP server over a typed operation layer. The repo is greenfield here — verified: no
`@modelcontextprotocol`, `openai`, `anthropic`, `ai`, or `langchain` dependency exists in `package.json`,
and `components/ai/` is a UI shell only (`ai-context.tsx`, `ai-floating-button.tsx`, `ai-sidebar.tsx` —
React state, no backend). Nothing to retrofit.

The realistic alternative was exposing the operations as REST routes under `app/api/agent/*`, which the
model calls via generic HTTP tooling.

## Decision

MCP is the transport. The operation layer (ADR-0001) holds all semantics — schemas, risk tiers,
capability requirements, dry-run, idempotency. MCP is a thin adapter over it.

**Explicit non-decision:** the design does not assume Hermes' tool-call convention. Hermes emits tool calls
in its own format and behaviour differs between Hermes versions and hosting runtimes. That must be
**confirmed against the actual deployment**, and a version or runtime change invalidates the prior
eval certification (`AGENT_ROLLOUT_PLAN.md §4`). MCP sits in front precisely so the model is swappable
without touching the contract.

## Consequences

**Positive.** Tool discovery, schema advertisement, and error semantics are standardised. Model-agnostic —
Hermes can be replaced without touching `lib/agent/operations/`. Because MCP is one authenticated
in-process entry point, it inherits none of the API-route auth problem: `middleware.ts:177` excludes
`api/`, ~36 routes self-authenticate or don't, and `middleware.ts:103-107` skips enforcement entirely for
requests carrying an attacker-supplied `rsc: 1` header. A REST agent surface would sit inside that mess.

**Negative.** MCP is younger and less battle-tested than REST; open-weight tool-callers degrade as tool
count grows. Mitigated by a ≤30-tool session budget (the procurement slice ships 23), module scoping, and
an `agent.describeCapabilities` discovery tool instead of exposing everything at once. A second transport
(REST, queue) can be added later against the same operation layer at low cost.

**Honest limitation.** MCP protects the agent's path only. Anything an attacker reaches through an
unauthenticated route bypasses the control plane entirely — see `AGENT_PHASE0_GATE.md` G-13.
