import React, { useEffect, useMemo, useState } from "react";

import { useDql } from "@dynatrace-sdk/react-hooks";
import { _SankeyChart as SankeyChart } from "@dynatrace/strato-components/charts";
import { ProgressCircle, EmptyState } from "@dynatrace/strato-components/content";
import type { Timeframe, TimeValue } from "@dynatrace/strato-components/core";
import { TimeframeSelector } from "@dynatrace/strato-components/filters";
import {
  FormField,
  Label,
  Select,
  Switch,
} from "@dynatrace/strato-components/forms";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { logDqlQuery } from "../utils/logDqlQuery";
import {
  transformCustomerJourneys,
  type JourneySessionRecord,
} from "../utils/customerJourneys";

const allFrontends = "all";
const noFrontendSelected = "";
const maxJourneyRecords = 10000;
const maxStepsPerSession = 131072;
const stepLimitOptions = [4, 8, 12, 16, 24];
const emptySessionRecords: JourneySessionRecord[] = [];

const frontendsQuery = `fetch dt.entity.application
| filter isNotNull(id) and isNotNull(entity.name)
| fields frontend_id = id, frontend = entity.name
| sort frontend`;

const escapeDqlString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const buildJourneyQuery = (frontendId: string) => {
  const frontendFilter =
    frontendId === allFrontends
      ? ""
      : `| filter frontend_id == "${escapeDqlString(frontendId)}"\n`;

  return `fetch user.events
| filter isNotNull(dt.rum.application.entity)
| filter isNotNull(dt.rum.session.id)
| fieldsAdd frontend_id = dt.rum.application.entity,
    frontend = entityName(dt.rum.application.entity, type:"dt.entity.application"),
    step_name = if(
        characteristics.has_navigation == true or characteristics.has_page_summary == true,
        page.url.path,
        else: if(characteristics.has_view_summary == true,
            view.name,
            else: if(characteristics.has_user_interaction == true,
                coalesce(ui_element.custom_name, ui_element.resolved_name, ui_element.name, interaction.name),
                else: null)))
${frontendFilter}| filter isNotNull(step_name)
| filter isNotNull(start_time)
| sort frontend_id, dt.rum.session.id, start_time
| summarize
    steps = collectArray(record(start_time, step_name), maxLength: ${maxStepsPerSession}),
    total_steps = count(),
    by: {frontend_id, frontend, session_id = dt.rum.session.id}`;
};

const createDefaultTimeframe = (): Timeframe => {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const timeValue = (date: Date, value: string): TimeValue => ({
    absoluteDate: date.toISOString(),
    value,
    type: "expression",
  });

  return {
    from: timeValue(start, "now-24h"),
    to: timeValue(end, "now"),
  };
};

const edgeId = (source: string, target: string) => `${source}\u0000${target}`;
const formatSessionCount = (value: number) => value.toLocaleString();
const formatPercentage = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

type FrontendRecord = {
  frontend_id: string;
  frontend: string;
};

const formatTimeframe = (timeframe: Timeframe) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `${formatter.format(new Date(timeframe.from.absoluteDate))} - ${formatter.format(
    new Date(timeframe.to.absoluteDate),
  )}`;
};

export const Sankey = () => {
  const [selectedFrontend, setSelectedFrontend] = useState(noFrontendSelected);
  const [timeframe, setTimeframe] = useState(createDefaultTimeframe);
  const [maxSteps, setMaxSteps] = useState(8);
  const [collapseConsecutiveDuplicates, setCollapseConsecutiveDuplicates] =
    useState(false);

  const timeframeOptions = useMemo(
    () => ({
      defaultTimeframeStart: timeframe.from.absoluteDate,
      defaultTimeframeEnd: timeframe.to.absoluteDate,
    }),
    [timeframe.from.absoluteDate, timeframe.to.absoluteDate],
  );
  const {
    data: frontendData,
    error: frontendError,
    isLoading: frontendsLoading,
  } = useDql<FrontendRecord>({
    query: frontendsQuery,
    maxResultRecords: maxJourneyRecords,
  });
  const journeyQuery = useMemo(
    () => buildJourneyQuery(selectedFrontend || allFrontends),
    [selectedFrontend],
  );
  const {
    data: sessionData,
    error: sessionError,
    isLoading: sessionsLoading,
  } = useDql<JourneySessionRecord>(
    {
      query: journeyQuery,
      ...timeframeOptions,
      maxResultRecords: maxJourneyRecords,
    },
    { enabled: selectedFrontend !== noFrontendSelected },
  );

  useEffect(() => {
    logDqlQuery(frontendsQuery);
  }, []);
  useEffect(() => {
    if (selectedFrontend !== noFrontendSelected) {
      logDqlQuery(journeyQuery, timeframeOptions);
    }
  }, [journeyQuery, selectedFrontend, timeframeOptions]);

  const frontendOptions = frontendData?.records ?? [];
  const sessionRecords =
    selectedFrontend === noFrontendSelected
      ? emptySessionRecords
      : sessionData?.records ?? emptySessionRecords;
  const journeyData = useMemo(
    () =>
      transformCustomerJourneys(sessionRecords, {
        maxSteps,
        collapseConsecutiveDuplicates,
      }),
    [collapseConsecutiveDuplicates, maxSteps, sessionRecords],
  );
  const error = frontendError ?? (selectedFrontend ? sessionError : null);
  const isLoading =
    frontendsLoading ||
    (selectedFrontend !== noFrontendSelected && sessionsLoading);
  const selectedFrontendLabel =
    selectedFrontend === noFrontendSelected
      ? "None selected"
      : selectedFrontend === allFrontends
      ? "All frontends"
      : frontendOptions.find(
          ({ frontend_id }) => frontend_id === selectedFrontend,
        )?.frontend ?? selectedFrontend;
  const timeframeLabel = formatTimeframe(timeframe);
  const dominantJourney = journeyData.journeys[0];
  const edgeById = useMemo(
    () =>
      new Map(
        journeyData.edges.map((edge) => [
          edgeId(edge.source, edge.target),
          edge,
        ]),
      ),
    [journeyData.edges],
  );
  const nodeById = useMemo(
    () => new Map(journeyData.nodes.map((node) => [node.id, node])),
    [journeyData.nodes],
  );
  const truncatedSessionCount = sessionRecords.filter(
    ({ steps, total_steps }) => total_steps > steps.length,
  ).length;

  const renderJourneyTooltip = (
    payload: Parameters<
      NonNullable<React.ComponentProps<typeof SankeyChart.Tooltip>["children"]>
    >[0],
  ) => {
    if (payload.type === "sankeyEdge") {
      const edge = edgeById.get(edgeId(payload.fromId, payload.toId));

      return (
        <Flex flexDirection="column" gap={4}>
          <Paragraph>
            <strong>From:</strong> {payload.fromLabel}
          </Paragraph>
          <Paragraph>
            <strong>To:</strong> {payload.toLabel}
          </Paragraph>
          <Paragraph>
            <strong>Sessions:</strong> {formatSessionCount(payload.value)}
          </Paragraph>
          <Paragraph>
            <strong>Of sessions reaching source:</strong>{" "}
            {formatPercentage(edge?.shareOfSource ?? 0)}
          </Paragraph>
        </Flex>
      );
    }

    const node = nodeById.get(payload.nodeId);

    return (
      <Flex flexDirection="column" gap={4}>
        <Paragraph>
          <strong>Step {node?.position ?? "?"}:</strong> {payload.label}
        </Paragraph>
        <Paragraph>
          <strong>Inflow:</strong>{" "}
          {formatSessionCount(payload.totalInflow)} sessions
        </Paragraph>
        <Paragraph>
          <strong>Outflow:</strong>{" "}
          {formatSessionCount(payload.totalOutflow)} sessions
        </Paragraph>
      </Flex>
    );
  };

  return (
    <Flex flexDirection="column" gap={16} padding={32}>
      <Heading level={2}>Customer Journeys</Heading>
      <Paragraph>
        Explore the most common complete journeys built from recorded RUM page,
        view, and interaction steps.
      </Paragraph>

      <Flex flexDirection="column" gap={12}>
        <TimeframeSelector
          name="journey-timeframe"
          value={timeframe}
          onChange={(value) => {
            if (value) setTimeframe(value);
          }}
        />
        <FormField>
          <Label>Frontend</Label>
          <Select
            name="frontend-select"
            value={selectedFrontend || null}
            onChange={(value) => setSelectedFrontend(value ?? noFrontendSelected)}
          >
            <Select.Content>
              <Select.Option value={allFrontends}>All frontends</Select.Option>
              {frontendOptions.map(({ frontend_id, frontend }) => (
                <Select.Option key={frontend_id} value={frontend_id}>
                  {frontend}
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </FormField>
        <FormField>
          <Label>Maximum steps</Label>
          <Select
            name="journey-step-limit"
            value={String(maxSteps)}
            onChange={(value) => {
              const nextValue = Number(value);
              if (stepLimitOptions.includes(nextValue)) setMaxSteps(nextValue);
            }}
          >
            <Select.Content>
              {stepLimitOptions.map((stepLimit) => (
                <Select.Option key={stepLimit} value={String(stepLimit)}>
                  {stepLimit} steps
                </Select.Option>
              ))}
            </Select.Content>
          </Select>
        </FormField>
        <Switch
          name="collapse-consecutive-duplicates"
          value={collapseConsecutiveDuplicates}
          onChange={setCollapseConsecutiveDuplicates}
        >
          Collapse consecutive duplicate steps
        </Switch>
      </Flex>

      <Paragraph>
        Frontend: {selectedFrontendLabel} | Timeframe: {timeframeLabel} |
        Sessions in top 10: {formatSessionCount(journeyData.totalSessions)}
      </Paragraph>
      {dominantJourney && (
        <Paragraph>
          <strong>
            Most common ({formatSessionCount(dominantJourney.sessions)}{" "}
            {dominantJourney.sessions === 1 ? "session" : "sessions"}):
          </strong>{" "}
          {dominantJourney.steps.join(" -> ")}
        </Paragraph>
      )}
      {sessionRecords.length >= maxJourneyRecords && (
        <Paragraph>
          The query reached the {formatSessionCount(maxJourneyRecords)} session
          result limit. Journey rankings may be incomplete; narrow the timeframe
          or select one frontend.
        </Paragraph>
      )}
      {truncatedSessionCount > 0 && (
        <Paragraph>
          {formatSessionCount(truncatedSessionCount)} sessions exceeded the
          DQL collection limit of {formatSessionCount(maxStepsPerSession)}
          events. Those very long sessions may have incomplete journey steps.
        </Paragraph>
      )}

      {isLoading ? (
        <Flex alignItems="center" gap={8}>
          <ProgressCircle size="small" aria-label="Loading customer journeys" />
          <Paragraph>
            {selectedFrontend
              ? "Loading customer journeys..."
              : "Loading frontends..."}
          </Paragraph>
        </Flex>
      ) : error ? (
        <EmptyState size="small">
          <EmptyState.Visual>
            <EmptyState.VisualPreset context="query" type="something-wrong" />
          </EmptyState.Visual>
          <EmptyState.Title>
            {frontendError
              ? "Unable to load frontends"
              : "Unable to load customer journeys"}
          </EmptyState.Title>
          <EmptyState.Details>{error.message}</EmptyState.Details>
        </EmptyState>
      ) : selectedFrontend === noFrontendSelected ? (
        <Paragraph>Select a frontend to load customer journeys.</Paragraph>
      ) : (
        <SankeyChart
          aria-label={`Top customer journeys for ${selectedFrontendLabel}`}
          edges={journeyData.edges}
          fromAccessor="source"
          toAccessor="target"
          valueAccessor="value"
          nodes={journeyData.nodes}
          nodeIdAccessor="id"
          nodeLabelAccessor="label"
          columnIdAccessor="column"
          columnLabels={journeyData.columnLabels}
          formatter={formatSessionCount}
          unit="sessions"
          truncationMode="middle"
          width="100%"
          height={520}
        >
          <SankeyChart.NodeStyle
            labelsDisplay="auto"
            width={14}
            alignment="justify"
          />
          <SankeyChart.Tooltip>{renderJourneyTooltip}</SankeyChart.Tooltip>
          <SankeyChart.EmptyState>
            <EmptyState size="small">
              <EmptyState.Visual>
                <EmptyState.VisualPreset context="chart" type="no-result" />
              </EmptyState.Visual>
              <EmptyState.Title>No customer journeys found</EmptyState.Title>
              <EmptyState.Details>
                Widen the timeframe or choose a different frontend.
              </EmptyState.Details>
            </EmptyState>
          </SankeyChart.EmptyState>
          <SankeyChart.ErrorState>
            <EmptyState size="small">
              <EmptyState.Visual>
                <EmptyState.VisualPreset
                  context="chart"
                  type="something-wrong"
                />
              </EmptyState.Visual>
              <EmptyState.Title>Unable to render the chart</EmptyState.Title>
              <EmptyState.Details>
                Check that every flow connects steps in increasing position
                order.
              </EmptyState.Details>
            </EmptyState>
          </SankeyChart.ErrorState>
        </SankeyChart>
      )}
    </Flex>
  );
};
