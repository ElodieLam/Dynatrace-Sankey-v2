import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  transformCustomerJourneys,
  type JourneySessionRecord,
} from "./customerJourneys";

const session = (sessionId: string, steps: string[]): JourneySessionRecord => ({
  frontend: "Storefront",
  frontend_id: "APPLICATION-1",
  session_id: sessionId,
  steps: steps.map((step_name, index) => ({
    start_time: index + 1,
    step_name,
  })),
  total_steps: steps.length,
});

describe("transformCustomerJourneys", () => {
  it("keeps loops acyclic by assigning node IDs to each step position", () => {
    const result = transformCustomerJourneys(
      [session("session-1", ["/home", "/vehicle", "/results", "/vehicle", "/manual"])],
      { maxSteps: 8, collapseConsecutiveDuplicates: false },
    );

    assert.deepEqual(
      result.nodes.map(({ id, label }) => ({ id, label })),
      [
        { id: "1:/home", label: "/home" },
        { id: "2:/vehicle", label: "/vehicle" },
        { id: "3:/results", label: "/results" },
        { id: "4:/vehicle", label: "/vehicle" },
        { id: "5:/manual", label: "/manual" },
      ],
    );
    assert.ok(
      result.edges.every(
        ({ source, target }) =>
          Number(target.split(":")[0]) === Number(source.split(":")[0]) + 1,
      ),
    );
  });

  it("aggregates shared transitions and computes the source continuation share", () => {
    const result = transformCustomerJourneys(
      [
        session("session-1", ["/home", "/search", "/manual"]),
        session("session-2", ["/home", "/search", "/manual"]),
        session("session-3", ["/home", "/search", "/contact"]),
      ],
      { maxSteps: 8, collapseConsecutiveDuplicates: false },
    );
    const sharedEdge = result.edges.find(
      ({ source, target }) => source === "1:/home" && target === "2:/search",
    );

    assert.equal(result.journeys.length, 2);
    assert.equal(result.totalSessions, 3);
    assert.equal(sharedEdge?.value, 3);
    assert.equal(sharedEdge?.sessionsReachedSource, 3);
    assert.equal(sharedEdge?.shareOfSource, 1);
  });

  it("preserves consecutive duplicates unless the collapse option is enabled", () => {
    const rows = [session("session-1", ["/home", "/home", "click", "click"])];
    const kept = transformCustomerJourneys(rows, {
      maxSteps: 8,
      collapseConsecutiveDuplicates: false,
    });
    const collapsed = transformCustomerJourneys(rows, {
      maxSteps: 8,
      collapseConsecutiveDuplicates: true,
    });

    assert.deepEqual(kept.journeys[0].steps, [
      "/home",
      "/home",
      "click",
      "click",
    ]);
    assert.deepEqual(collapsed.journeys[0].steps, ["/home", "click"]);
  });

  it("sorts recorded steps by start time before applying the configured cap", () => {
    const unsortedSession: JourneySessionRecord = {
      ...session("session-1", []),
      steps: [
        { start_time: 3, step_name: "/results" },
        { start_time: 1, step_name: "/home" },
        { start_time: 2, step_name: "/search" },
      ],
      total_steps: 3,
    };
    const result = transformCustomerJourneys([unsortedSession], {
      maxSteps: 2,
      collapseConsecutiveDuplicates: false,
    });

    assert.deepEqual(result.journeys[0].steps, ["/home", "/search"]);
  });
});
