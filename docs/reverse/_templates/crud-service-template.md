# CRUD Service Template

Use this template when adding a new domain endpoint. It enforces the future architecture target (route → service → repo) without breaking the current inline-route style for legacy code.

## 1. File layout (proposed)

```
artifacts/api-server/src/
├─ routes/
│  └─ widgets.ts            ← thin HTTP layer
├─ services/
│  └─ widget-service.ts     ← business rules, transactions, audit
├─ repositories/
│  └─ widget-repo.ts        ← Drizzle queries only
└─ errors/
   └─ AppError.ts           ← typed errors thrown by services
```

## 2. Route handler

```ts
// routes/widgets.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { CreateWidgetBody, UpdateWidgetBody, ListWidgetsQuery } from "@workspace/api-zod";
import * as widgetService from "../services/widget-service";

const router = Router();
router.use(requireAuth);

router.get("/v1/widgets", async (req, res, next) => {
  try {
    const query = ListWidgetsQuery.parse(req.query);
    const widgets = await widgetService.list(query);
    res.json({ data: widgets });
  } catch (err) { next(err); }
});

router.post("/v1/widgets", async (req, res, next) => {
  try {
    const body = CreateWidgetBody.parse(req.body);
    const widget = await widgetService.create(body, req.user!);
    res.status(201).json({ data: widget });
  } catch (err) { next(err); }
});

router.patch("/v1/widgets/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = UpdateWidgetBody.parse(req.body);
    const widget = await widgetService.update(id, body, req.user!);
    res.json({ data: widget });
  } catch (err) { next(err); }
});

router.delete("/v1/widgets/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await widgetService.softDelete(id, req.user!);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
```

## 3. Service layer

```ts
// services/widget-service.ts
import { db } from "@workspace/db";
import * as widgetRepo from "../repositories/widget-repo";
import { logAction } from "../lib/audit";
import { AppError } from "../errors/AppError";

export async function list(query: ListWidgetsQueryInput) { return widgetRepo.list(query); }

export async function create(input: CreateWidgetInput, actor: AuthedUser) {
  return db.transaction(async (tx) => {
    const widget = await widgetRepo.insert(tx, input);
    await logAction(tx, {
      entity_type: "widget",
      entity_id:   widget.id,
      action:      "CREATE",
      actor_id:    actor.id,
      actor_email: actor.email,
      new_value:   widget,
    });
    return widget;
  });
}

export async function update(id: number, input: UpdateWidgetInput, actor: AuthedUser) {
  const existing = await widgetRepo.getById(id);
  if (!existing) throw new AppError("WIDGET_NOT_FOUND", "Widget not found", 404);
  if (existing.locked) throw new AppError("WIDGET_LOCKED", "Widget cannot be edited", 409);

  return db.transaction(async (tx) => {
    const updated = await widgetRepo.update(tx, id, input);
    await logAction(tx, {
      entity_type: "widget", entity_id: id, action: "UPDATE",
      actor_id: actor.id, actor_email: actor.email,
      old_value: existing, new_value: updated,
    });
    return updated;
  });
}

export async function softDelete(id: number, actor: AuthedUser) { /* same shape */ }
```

## 4. Repository layer

```ts
// repositories/widget-repo.ts
import { db, widgets } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

export async function list(query: ListWidgetsQueryInput) {
  return db.select().from(widgets)
    .where(and(isNull(widgets.deleted_at) /* ...query filters */));
}

export async function getById(id: number) {
  return db.query.widgets.findFirst({ where: and(eq(widgets.id, id), isNull(widgets.deleted_at)) });
}

export async function insert(tx, values: CreateWidgetInput) {
  const [row] = await tx.insert(widgets).values(values).returning();
  return row;
}

export async function update(tx, id: number, values: UpdateWidgetInput) {
  const [row] = await tx.update(widgets).set({ ...values, updated_at: new Date() })
    .where(eq(widgets.id, id)).returning();
  return row;
}
```

## 5. AppError + global error middleware

```ts
// errors/AppError.ts
export class AppError extends Error {
  constructor(public code: string, public message: string, public status = 400) { super(message); }
}

// middlewares/errorHandler.ts (mount LAST in app.ts)
import { ZodError } from "zod";
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() } });
  }
  // never expose internals
  console.error("[unhandled]", err);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
```

## 6. Required checklist for new endpoints

- [ ] Zod schema in `lib/api-zod` (or generated from OpenAPI)
- [ ] Auth middleware applied
- [ ] Service called from route (no direct Drizzle in route)
- [ ] Audit log on every state-changing op
- [ ] Soft-delete on `DELETE` (sets `deleted_at`)
- [ ] Returns standardized envelope `{ data }` for success, `{ success:false, error:{code,message} }` for errors
- [ ] Uses `next(err)` instead of `res.status(500).json(...)` — global handler does the rest
