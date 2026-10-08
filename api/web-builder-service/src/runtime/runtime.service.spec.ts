import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectsService } from '../projects/projects.service';
import { RuntimeService } from './runtime.service';

describe('RuntimeService', () => {
  let dir: string;
  let projects: ProjectsService;
  let runtime: RuntimeService;

  const project = {
    version: 2,
    id: 'app-1',
    name: 'Directory',
    pages: [{ id: 'p1', slug: 'home', blocks: [] }],
    updatedAt: '',
    dataSources: [
      {
        id: 'people',
        kind: 'collection',
        query: {
          filter: {
            kind: 'conditions',
            group: {
              combinator: 'and',
              conditions: [
                {
                  field: 'city',
                  operator: 'eq',
                  value: 'fields.city',
                  source: 'param',
                },
              ],
            },
          },
          searchFields: ['name'],
          sort: [{ field: 'score', direction: 'desc' }],
          limit: 10,
          select: ['name', 'score'],
        },
      },
      { id: 'static', kind: 'json', json: '[]' },
    ],
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wb-rt-'));
    process.env.WEB_BUILDER_DATA_DIR = dir;
    projects = new ProjectsService();
    runtime = new RuntimeService(projects);
    await projects.publish('app-1', project);
  });

  afterEach(async () => {
    delete process.env.WEB_BUILDER_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  const seed = async () => {
    for (const [name, city, score] of [
      ['Ada', 'London', 91],
      ['Grace', 'New York', 78],
      ['Alan', 'London', 85],
      ['Linus', 'Helsinki', 60],
    ] as const)
      await runtime.add('app-1', 'people', { name, city, score });
  };

  it('stores records with ids, idempotently, and clears them', async () => {
    const row = await runtime.add('app-1', 'people', { id: 'r1', name: 'Ada' });
    expect(row).toMatchObject({ id: 'r1', name: 'Ada' });
    expect(typeof row.createdAt).toBe('string');
    await runtime.add('app-1', 'people', { id: 'r1', name: 'Ada again' });
    expect(await runtime.list('app-1', 'people')).toHaveLength(1);
    await runtime.clear('app-1', 'people');
    expect(await runtime.list('app-1', 'people')).toEqual([]);
  });

  it('keeps concurrent submissions', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        runtime.add('app-1', 'people', { name: `P${index}` }),
      ),
    );
    expect(await runtime.list('app-1', 'people')).toHaveLength(20);
  });

  it('runs the saved frame with parameter values only', async () => {
    await seed();
    expect(
      await runtime.query('app-1', 'people', {
        params: { 'fields.city': 'London' },
      }),
    ).toEqual({
      rows: [
        { name: 'Ada', score: 91 },
        { name: 'Alan', score: 85 },
      ],
      total: 2,
    });
    expect(
      (
        await runtime.query('app-1', 'people', {
          params: { 'fields.city': 'London' },
          term: 'ala',
        })
      ).rows,
    ).toEqual([{ name: 'Alan', score: 85 }]);
    expect(
      (
        await runtime.query('app-1', 'people', {
          params: { 'fields.city': 'London' },
          limit: 1,
          offset: 1,
        })
      ).rows,
    ).toEqual([{ name: 'Alan', score: 85 }]);
    // A value that looks like logic is still just a value.
    expect(
      (
        await runtime.query('app-1', 'people', {
          params: { 'fields.city': { or: [true] } },
        })
      ).rows,
    ).toEqual([]);
    // Extra keys a client might send (a filter of its own) are ignored.
    expect(
      (
        await runtime.query('app-1', 'people', {
          params: { 'fields.city': 'Helsinki' },
          filter: true,
        } as never)
      ).total,
    ).toBe(1);
  });

  it('rejects unknown sources, non-collections and unsafe records', async () => {
    await expect(runtime.list('app-1', 'nope')).rejects.toThrow(
      'no such collection',
    );
    await expect(runtime.list('app-1', 'static')).rejects.toThrow(
      'no such collection',
    );
    await expect(runtime.list('../etc', 'people')).rejects.toThrow('Invalid');
    await expect(runtime.add('app-1', 'people', [1, 2])).rejects.toThrow(
      'must be an object',
    );
    const row = await runtime.add(
      'app-1',
      'people',
      JSON.parse(
        '{"name":"x","__proto__":{"admin":true},"nested":{"constructor":1,"ok":2}}',
      ),
    );
    expect(Object.keys(row).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'nested',
    ]);
    expect(row.nested).toEqual({ ok: 2 });
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});
