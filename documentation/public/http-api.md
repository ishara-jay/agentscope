# Current HTTP API

The backend currently exposes one endpoint. The ingest and graph endpoints in
the shared contract are planned and are tracked by
[FR-2](../requirements/FR-2-ingest-storage.md) and
[FR-3](../requirements/FR-3-graph-reconstruction.md).

## `GET /health`

Checks that the NestJS process started and its database connection initialized.

```bash
curl http://localhost:3001/health
```

Successful response (`200 OK`):

```json
{ "status": "ok" }
```

The service requires `DATABASE_URL` at startup. See
[Getting started](getting-started.md) for the local connection string and
migration command.
