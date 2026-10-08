import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let dir: string;
  let service: ProjectsService;
  const project = (id: string, extra: Record<string, unknown> = {}) => ({
    version: 2,
    id,
    name: 'Demo',
    pages: [{ id: 'p1', slug: 'home', blocks: [] }],
    updatedAt: '',
    ...extra,
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wb-'));
    process.env.WEB_BUILDER_DATA_DIR = dir;
    service = new ProjectsService();
  });

  afterEach(async () => {
    delete process.env.WEB_BUILDER_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('saves, lists, publishes and deletes projects', async () => {
    await service.save('abc-1', project('abc-1'));
    expect(
      (await service.list()).map((item) => [item.id, item.published]),
    ).toEqual([['abc-1', false]]);
    await service.publish('abc-1', project('abc-1', { name: 'Live' }));
    expect((await service.getPublished('abc-1')).name).toBe('Live');
    expect((await service.list())[0].published).toBe(true);
    await service.remove('abc-1');
    expect(await service.list()).toEqual([]);
    await expect(service.getPublished('abc-1')).rejects.toThrow(
      'not been published',
    );
  });

  it('rejects path traversal, mismatched ids and malformed bodies', async () => {
    await expect(service.get('../etc/passwd')).rejects.toThrow(
      'Invalid project id',
    );
    await expect(service.save('abc', project('other'))).rejects.toThrow(
      'does not match',
    );
    await expect(service.save('abc', { version: 1 })).rejects.toThrow(
      'Unsupported project version',
    );
    await expect(
      service.save('abc', project('abc', { pages: [] })),
    ).rejects.toThrow('between 1 and 50');
  });
});
