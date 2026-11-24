export type JourneyStepRecord = {
  start_time: string | number;
  step_name: string;
};

export type JourneySessionRecord = {
  frontend: string;
  frontend_id: string;
  session_id: string;
  steps: JourneyStepRecord[];
  total_steps: number;
};

export type CustomerJourney = {
  steps: string[];
  sessions: number;
};

export type JourneyNode = {
  id: string;
  label: string;
  position: number;
  column: string;
};

export type JourneyEdge = {
  source: string;
  target: string;
  value: number;
  sessionsReachedSource: number;
  shareOfSource: number;
};

export type CustomerJourneyChartData = {
  edges: JourneyEdge[];
  nodes: JourneyNode[];
  journeys: CustomerJourney[];
  columnLabels: Record<string, string>;
  totalSessions: number;
};

export type JourneyTransformOptions = {
  maxSteps: number;
  collapseConsecutiveDuplicates: boolean;
  maxJourneys?: number;
};

const topJourneysLimit = 10;

const timestampValue = (value: string | number) =>
  typeof value === "number" ? value : Date.parse(value);

const comparePaths = (left: string[], right: string[]) => {
  const leftKey = JSON.stringify(left);
  const rightKey = JSON.stringify(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const nodeId = (position: number, label: string) => `${position}:${label}`;

const edgeId = (source: string, target: string) => `${source}\u0000${target}`;

export const transformCustomerJourneys = (
  sessionRecords: JourneySessionRecord[],
  {
    maxSteps,
    collapseConsecutiveDuplicates,
    maxJourneys = topJourneysLimit,
  }: JourneyTransformOptions,
): CustomerJourneyChartData => {
  if (!Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new RangeError("maxSteps must be a positive integer.");
  }
  if (!Number.isInteger(maxJourneys) || maxJourneys < 1) {
    throw new RangeError("maxJourneys must be a positive integer.");
  }

  const journeyCounts = new Map<string, CustomerJourney>();

  sessionRecords.forEach(({ steps }) => {
    const chronologicalSteps = steps
      .map((step, index) => ({
        index,
        label: step.step_name,
        timestamp: timestampValue(step.start_time),
      }))
      .sort((left, right) => {
        const timeDifference = left.timestamp - right.timestamp;
        return Number.isNaN(timeDifference) || timeDifference === 0
          ? left.index - right.index
          : timeDifference;
      })
      .map(({ label }) => label)
      .filter((label) => label.length > 0);

    const distinctConsecutiveSteps = collapseConsecutiveDuplicates
      ? chronologicalSteps.filter(
          (step, index) => index === 0 || step !== chronologicalSteps[index - 1],
        )
      : chronologicalSteps;
    const path = distinctConsecutiveSteps.slice(0, maxSteps);
    if (path.length === 0) return;

    const key = JSON.stringify(path);
    const existing = journeyCounts.get(key);
    if (existing) {
      existing.sessions += 1;
    } else {
      journeyCounts.set(key, { steps: path, sessions: 1 });
    }
  });

  const journeys = [...journeyCounts.values()]
    .sort(
      (left, right) =>
        right.sessions - left.sessions || comparePaths(left.steps, right.steps),
    )
    .slice(0, maxJourneys);
  const nodesById = new Map<string, JourneyNode>();
  const edgesById = new Map<string, JourneyEdge>();
  const sessionsReachedByNode = new Map<string, number>();

  journeys.forEach(({ steps, sessions }) => {
    steps.forEach((label, index) => {
      const currentId = nodeId(index + 1, label);
      nodesById.set(currentId, {
        id: currentId,
        label,
        position: index + 1,
        column: `step-${index + 1}`,
      });
      sessionsReachedByNode.set(
        currentId,
        (sessionsReachedByNode.get(currentId) ?? 0) + sessions,
      );

      if (index === 0) return;

      const source = nodeId(index, steps[index - 1]);
      const id = edgeId(source, currentId);
      const existing = edgesById.get(id);
      if (existing) {
        existing.value += sessions;
      } else {
        edgesById.set(id, {
          source,
          target: currentId,
          value: sessions,
          sessionsReachedSource: 0,
          shareOfSource: 0,
        });
      }
    });
  });

  const edges = [...edgesById.values()].map((edge) => {
    const sessionsReachedSource =
      sessionsReachedByNode.get(edge.source) ?? 0;

    return {
      ...edge,
      sessionsReachedSource,
      shareOfSource:
        sessionsReachedSource === 0 ? 0 : edge.value / sessionsReachedSource,
    };
  });
  const nodes = [...nodesById.values()].sort(
    (left, right) =>
      left.position - right.position || comparePaths([left.label], [right.label]),
  );
  const lastPosition = nodes.at(-1)?.position ?? 0;
  const columnLabels = Object.fromEntries(
    Array.from({ length: lastPosition }, (_, index) => [
      `step-${index + 1}`,
      `Step ${index + 1}`,
    ]),
  );

  return {
    edges,
    nodes,
    journeys,
    columnLabels,
    totalSessions: journeys.reduce((total, journey) => total + journey.sessions, 0),
  };
};
