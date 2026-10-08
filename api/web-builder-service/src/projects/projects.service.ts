import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  rename,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ID = /^[a-zA-Z0-9-]{1,80}$/;
export const MAX_PROJECT_BYTES = 4_000_000;

export interface ProjectSummary {
  id: string;
  name: string;
  pages: number;
  updatedAt: string;
  published: boolean;
}

type StoredProject = Record<string, unknown> & {
  id: string;
  name: string;
  pages: unknown[];
  updatedAt: string;
};

/**
 * File-backed store for web builder projects. Each project is one JSON file; publishing writes an
 * immutable snapshot next to it. The studio and the published app re-validate every project they
 * load, so the server only enforces structure, identifiers and size.
 */
@Injectable()
export class ProjectsService {
  private readonly root = resolve(
    process.env.WEB_BUILDER_DATA_DIR ||
      join(process.cwd(), 'data', 'web-builder'),
  );
  private readonly drafts = join(this.root, 'projects');
  private readonly published = join(this.root, 'published');

  private file(folder: string, id: string): string {
    if (!ID.test(id)) throw new BadRequestException('Invalid project id.');
    return join(folder, `${id}.json`);
  }

  private async read(path: string): Promise<StoredProject | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as StoredProject;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Writes through a temporary file so a crash never leaves a half-written project. */
  private async write(
    folder: string,
    id: string,
    project: StoredProject,
  ): Promise<void> {
    await mkdir(folder, { recursive: true });
    const target = this.file(folder, id);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(project), 'utf8');
    await rename(temporary, target);
  }

  validate(id: string, body: unknown): StoredProject {
    if (!ID.test(id)) throw new BadRequestException('Invalid project id.');
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Body must be a project object.');
    const project = body as Record<string, unknown>;
    if (project.version !== 2)
      throw new BadRequestException('Unsupported project version.');
    if (project.id !== id)
      throw new BadRequestException('Project id does not match the URL.');
    if (typeof project.name !== 'string' || project.name.length > 200)
      throw new BadRequestException('Invalid project name.');
    if (
      !Array.isArray(project.pages) ||
      project.pages.length < 1 ||
      project.pages.length > 50
    )
      throw new BadRequestException('A project needs between 1 and 50 pages.');
    if (Buffer.byteLength(JSON.stringify(project)) > MAX_PROJECT_BYTES)
      throw new PayloadTooLargeException('Project exceeds the 4 MB limit.');
    return project as StoredProject;
  }

  async list(): Promise<ProjectSummary[]> {
    let files: string[] = [];
    try {
      files = (await readdir(this.drafts)).filter((name) =>
        name.endsWith('.json'),
      );
    } catch {
      return [];
    }
    const summaries: ProjectSummary[] = [];
    for (const name of files) {
      const project = await this.read(join(this.drafts, name)).catch(
        () => null,
      );
      if (!project || !ID.test(String(project.id))) continue;
      const published =
        (await this.read(this.file(this.published, project.id)).catch(
          () => null,
        )) !== null;
      summaries.push({
        id: project.id,
        name: String(project.name),
        pages: project.pages?.length ?? 0,
        updatedAt: String(project.updatedAt ?? ''),
        published,
      });
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<StoredProject> {
    const project = await this.read(this.file(this.drafts, id));
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  async save(id: string, body: unknown): Promise<StoredProject> {
    const project = {
      ...this.validate(id, body),
      updatedAt: new Date().toISOString(),
    };
    await this.write(this.drafts, id, project);
    return project;
  }

  async remove(id: string): Promise<{ id: string }> {
    await rm(this.file(this.drafts, id), { force: true });
    await rm(this.file(this.published, id), { force: true });
    return { id };
  }

  async publish(
    id: string,
    body: unknown,
  ): Promise<{ id: string; publishedAt: string }> {
    const project = this.validate(id, body);
    await this.write(this.drafts, id, {
      ...project,
      updatedAt: new Date().toISOString(),
    });
    await this.write(this.published, id, project);
    return { id, publishedAt: new Date().toISOString() };
  }

  async getPublished(id: string): Promise<StoredProject> {
    const project = await this.read(this.file(this.published, id));
    if (!project)
      throw new NotFoundException('This app has not been published.');
    return project;
  }
}
