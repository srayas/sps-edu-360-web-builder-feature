import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  Expr,
  FramedQuery,
  LogicError,
  QUERY_LIMITS,
  QueryResult,
  Rule,
  SortSpec,
  createEngine,
  exprToRule,
  normalizeQuery,
  runQuery,
} from '@spsedu360/json-logic';
import { ProjectsService } from '../projects/projects.service';

const ID = /^[a-zA-Z0-9-]{1,80}$/;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const RUNTIME_LIMITS = {
  rowsPerCollection: 5000,
  rowBytes: 32_000,
  keysPerRow: 100,
  params: 50,
  paramBytes: 10_000,
};

type Row = Record<string, unknown>;

interface StoredSource {
  id: string;
  kind: string;
  name?: string;
  query?: {
    filter?: Expr;
    transform?: Expr;
    searchFields?: string[];
    sort?: SortSpec[];
    limit?: number;
    select?: string[];
  };
}

/** What a client may send: values for the frame's parameters and paging — never the query itself. */
export interface RuntimeQueryInput {
  params?: Record<string, unknown>;
  term?: string;
  offset?: number;
  limit?: number;
}

/**
 * Records stored by published apps ("collection" data sources) and framed queries over them.
 * The query that runs is always the one designed in the studio and saved with the project; a
 * client only supplies parameter values, a search term and paging. Rules run on the compiled,
 * sandboxed JSON Logic engine shared with the app.
 */
@Injectable()
export class RuntimeService {
  private readonly engine = createEngine({
    maxDepth: 64,
    maxIterations: 2_000_000,
  });
  private readonly root = resolve(
    process.env.WEB_BUILDER_DATA_DIR ||
      join(process.cwd(), 'data', 'web-builder'),
    'collections',
  );
  /** Serializes writes per collection so concurrent submissions never lose rows. */
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly projects: ProjectsService) {}

  private file(projectId: string, sourceId: string): string {
    if (!ID.test(projectId) || !ID.test(sourceId))
      throw new BadRequestException('Invalid project or source id.');
    return join(this.root, projectId, `${sourceId}.json`);
  }

  /** The source as designed in the studio: the published snapshot, or the draft before publishing. */
  private async source(
    projectId: string,
    sourceId: string,
  ): Promise<StoredSource> {
    if (!ID.test(projectId) || !ID.test(sourceId))
      throw new BadRequestException('Invalid project or source id.');
    const project = await this.projects
      .getPublished(projectId)
      .catch(() => this.projects.get(projectId));
    const sources = Array.isArray(project.dataSources)
      ? (project.dataSources as StoredSource[])
      : [];
    const source = sources.find((item) => item?.id === sourceId);
    if (!source || source.kind !== 'collection')
      throw new NotFoundException('This app has no such collection.');
    return source;
  }

  private async rows(path: string): Promise<Row[]> {
    try {
      const data = JSON.parse(await readFile(path, 'utf8')) as unknown;
      return Array.isArray(data) ? (data as Row[]) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async persist(path: string, rows: Row[]): Promise<void> {
    await mkdir(resolve(path, '..'), { recursive: true });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(rows), 'utf8');
    await rename(temporary, path);
  }

  private exclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const settled = next.catch(() => undefined);
    this.locks.set(key, settled);
    void settled.then(() => {
      if (this.locks.get(key) === settled) this.locks.delete(key);
    });
    return next;
  }

  /** Copies a submitted record keeping JSON-safe values only; adds `id` and `createdAt`. */
  cleanRow(input: unknown): Row {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('A record must be an object.');
    if (Buffer.byteLength(JSON.stringify(input)) > RUNTIME_LIMITS.rowBytes)
      throw new PayloadTooLargeException('The record is too large.');
    const entries = Object.entries(input as Row).filter(
      ([key]) => !BLOCKED_KEYS.has(key) && key.length <= 100,
    );
    if (entries.length > RUNTIME_LIMITS.keysPerRow)
      throw new BadRequestException('The record has too many fields.');
    const row = Object.create(null) as Row;
    for (const [key, value] of entries) row[key] = sanitize(value, 0);
    const id = row.id;
    if (
      !(typeof id === 'string' && id.length > 0 && id.length <= 100) &&
      typeof id !== 'number'
    )
      row.id = randomUUID();
    if (typeof row.createdAt !== 'string')
      row.createdAt = new Date().toISOString();
    return { ...row };
  }

  async list(projectId: string, sourceId: string): Promise<Row[]> {
    await this.source(projectId, sourceId);
    return this.rows(this.file(projectId, sourceId));
  }

  async add(projectId: string, sourceId: string, body: unknown): Promise<Row> {
    await this.source(projectId, sourceId);
    const row = this.cleanRow(body);
    const path = this.file(projectId, sourceId);
    return this.exclusive(path, async () => {
      const rows = await this.rows(path);
      // Idempotent: a retried submission with the same id does not create a duplicate.
      const existing = rows.find((item) => item.id === row.id);
      if (existing) return existing;
      if (rows.length >= RUNTIME_LIMITS.rowsPerCollection)
        throw new PayloadTooLargeException('This collection is full.');
      rows.push(row);
      await this.persist(path, rows);
      return row;
    });
  }

  /** Merges new values into one record (its id and createdAt are kept). */
  async update(
    projectId: string,
    sourceId: string,
    recordId: string,
    body: unknown,
  ): Promise<Row> {
    await this.source(projectId, sourceId);
    const changes = this.cleanRow(body);
    const path = this.file(projectId, sourceId);
    return this.exclusive(path, async () => {
      const rows = await this.rows(path);
      const index = rows.findIndex((row) => String(row.id) === recordId);
      if (index < 0) throw new NotFoundException('Record not found.');
      const { id: _id, createdAt: _createdAt, ...values } = changes;
      void _id;
      void _createdAt;
      rows[index] = {
        ...rows[index],
        ...values,
        updatedAt: new Date().toISOString(),
      };
      await this.persist(path, rows);
      return rows[index];
    });
  }

  async removeRecord(
    projectId: string,
    sourceId: string,
    recordId: string,
  ): Promise<{ id: string }> {
    await this.source(projectId, sourceId);
    const path = this.file(projectId, sourceId);
    return this.exclusive(path, async () => {
      const rows = await this.rows(path);
      const next = rows.filter((row) => String(row.id) !== recordId);
      if (next.length === rows.length)
        throw new NotFoundException('Record not found.');
      await this.persist(path, next);
      return { id: recordId };
    });
  }

  async clear(projectId: string, sourceId: string): Promise<{ cleared: true }> {
    await this.source(projectId, sourceId);
    const path = this.file(projectId, sourceId);
    await this.exclusive(path, () => rm(path, { force: true }));
    return { cleared: true };
  }

  /** Runs the collection's saved frame with the client's parameter values. */
  async query(
    projectId: string,
    sourceId: string,
    input: RuntimeQueryInput = {},
  ): Promise<QueryResult> {
    const source = await this.source(projectId, sourceId);
    const frame = source.query ?? {};
    const params = this.params(input.params);
    let query: FramedQuery;
    try {
      const pageLimit = clampInt(input.limit, 1, QUERY_LIMITS.maxLimit);
      const frameLimit = clampInt(frame.limit, 1, QUERY_LIMITS.maxLimit);
      const term =
        typeof input.term === 'string'
          ? input.term.trim().slice(0, QUERY_LIMITS.maxTerm)
          : '';
      query = normalizeQuery(
        {
          filter: frame.filter ? toRule(frame.filter) : undefined,
          transform: frame.transform ? toRule(frame.transform) : undefined,
          search: term ? { term, fields: frame.searchFields ?? [] } : undefined,
          sort: frame.sort,
          select: frame.select?.length ? frame.select : undefined,
          offset: clampInt(input.offset, 0, 1_000_000),
          limit: Math.min(
            pageLimit ?? QUERY_LIMITS.maxLimit,
            frameLimit ?? QUERY_LIMITS.maxLimit,
          ),
        },
        this.engine,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid query.',
      );
    }
    const rows = await this.rows(this.file(projectId, sourceId));
    try {
      return runQuery(rows, query, this.engine, params);
    } catch (error) {
      if (error instanceof LogicError)
        throw new BadRequestException(
          `The query could not run: ${error.message}`,
        );
      throw error;
    }
  }

  /** Parameter values are plain data (they are bound as literals, never read as rules). */
  private params(input: unknown): Record<string, unknown> {
    if (input === undefined || input === null) return {};
    if (typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('Parameters must be an object.');
    if (Buffer.byteLength(JSON.stringify(input)) > RUNTIME_LIMITS.paramBytes)
      throw new PayloadTooLargeException('Parameters are too large.');
    const entries = Object.entries(input as Row).filter(
      ([key]) => !BLOCKED_KEYS.has(key),
    );
    if (entries.length > RUNTIME_LIMITS.params)
      throw new BadRequestException('Too many parameters.');
    const out = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of entries) out[key] = sanitize(value, 0);
    return { ...out };
  }
}

function toRule(expr: Expr): Rule {
  if (
    !expr ||
    typeof expr !== 'object' ||
    !['conditions', 'template', 'rule'].includes(expr.kind)
  )
    throw new LogicError('The saved query is not valid.');
  return exprToRule(expr);
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  const number = Number(value);
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    !Number.isFinite(number)
  )
    return undefined;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

/** Deep-copies JSON data, dropping prototype keys and limiting nesting. */
function sanitize(value: unknown, depth: number): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (depth > 8)
    throw new BadRequestException('The record is nested too deeply.');
  if (Array.isArray(value))
    return value.map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out: Row = {};
    for (const [key, item] of Object.entries(value as Row))
      if (!BLOCKED_KEYS.has(key)) out[key] = sanitize(item, depth + 1);
    return out;
  }
  return null;
}
