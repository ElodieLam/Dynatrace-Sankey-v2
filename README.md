# Dynatrace Sankey v2

A Dynatrace AppEngine app that visualizes real-user navigation flows with a
Sankey chart.

## Sankey chart

Open **Sankey Chart** in the app navigation to inspect the 10 most common
complete customer journeys from RUM `user.events`. The frontend selector starts
empty, and the journey query waits until you select a frontend. Choose **All
frontends** explicitly to analyze them together. Changing the frontend or
timeframe recalculates the journeys. Journeys use recorded page paths, view
names, and UI interaction names, ordered by `start_time`. The default path cap
is 8 steps, and consecutive duplicates are preserved unless **Collapse
consecutive duplicate steps** is enabled.

Frontend options are fetched directly from `dt.entity.application`. The RUM
`user.events` journey query remains disabled until you select a frontend, then
filters events to that application (or includes all applications if you
explicitly select **All frontends**).

The ranked list shows the dominant path and the session totals for the top 10.
The Sankey chart aggregates only those journeys, preserves loops with
position-specific node IDs, and shows transition counts and source continuation
shares in tooltips.

The query collects each step with its `start_time`; the client sorts those
records because DQL `collectArray` does not guarantee element order. Identical
journey sequences are grouped client-side rather than relying on a DQL
array-to-key conversion. The query returns at most 10,000 session records; the
page warns when that cap is reached. DQL also caps one session's collected
steps at 131,072. High-cardinality paths and very long sessions can therefore
increase query and client memory use.

The project currently installs `@dynatrace/strato-components`, not
`@dynatrace/strato-components-preview`. Its Sankey chart is exposed as the
internal-only `_SankeyChart` export, so that API may change between Strato
releases.

The app's declared access scopes are in
[app.config.json](./sankey-v-2/app.config.json). The RUM page uses
`storage:user.events:read` and application metadata scopes; approve updated app
permissions when deploying or installing the app.