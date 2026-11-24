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

## DQL queries

The frontend selector is populated by this entity query; it does not scan RUM
events:

```dql
fetch dt.entity.application
| filter isNotNull(id) and isNotNull(entity.name)
| fields frontend_id = id, frontend = entity.name
| sort frontend
```

After a frontend is selected, the app executes this journey query. The selected
frontend filter is inserted after `fieldsAdd` and before the step filters. It
is omitted when **All frontends** is selected.

```dql
fetch user.events
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
| filter isNotNull(step_name)
| filter isNotNull(start_time)
| sort frontend_id, dt.rum.session.id, start_time
| summarize
    steps = collectArray(record(start_time, step_name), maxLength: 131072),
    total_steps = count(),
    by: {frontend_id, frontend, session_id = dt.rum.session.id}
```

The optional frontend filter is:

```dql
| filter frontend_id == "<selected frontend ID>"
```

The selected timeframe is passed through the `useDql` timeframe options rather
than written as a `from:` clause. The journey query returns one row per session;
the client orders collected steps by timestamp, groups identical paths, and
selects the top 10 journeys. DQL's `maxResultRecords` is set to 10,000 for this
query.

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