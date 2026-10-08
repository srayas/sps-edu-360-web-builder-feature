import { Injectable, InjectionToken, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import {
  Project,
  ProjectSummary,
  createProject,
  migrateV1,
  normalizeProject,
} from '../model'

export interface BuilderConfig {
  /** Base URL of web-builder-service (e.g. http://localhost:3000). Empty keeps projects in this browser. */
  apiBaseUrl: string
}

export const BUILDER_CONFIG = new InjectionToken<BuilderConfig>(
  'BUILDER_CONFIG',
  { factory: () => ({ apiBaseUrl: '' }) },
)

/** Storage for builder projects and their published snapshots. */
export abstract class ProjectRepository {
  abstract readonly location: 'browser' | 'server'
  abstract list(): Promise<ProjectSummary[]>
  abstract get(id: string): Promise<Project | null>
  abstract save(project: Project): Promise<Project>
  abstract remove(id: string): Promise<void>
  /** Stores an immutable snapshot that the published app serves. */
  abstract publish(project: Project): Promise<void>
  abstract published(id: string): Promise<Project | null>
}

const summary = (project: Project, published: boolean): ProjectSummary => ({
  id: project.id,
  name: project.name,
  pages: project.pages.length,
  updatedAt: project.updatedAt,
  published,
})

/** Keeps projects in localStorage. Every read is validated, so tampered data cannot break the studio. */
@Injectable()
export class BrowserProjectRepository extends ProjectRepository {
  readonly location = 'browser' as const
  private readonly prefix = 'wb-project:'
  private readonly publishedPrefix = 'wb-published:'

  constructor() {
    super()
    this.migrateLegacy()
  }

  async list(): Promise<ProjectSummary[]> {
    const items: ProjectSummary[] = []
    for (const key of this.keys(this.prefix)) {
      const project = this.read(key)
      if (project)
        items.push(
          summary(project, this.has(this.publishedPrefix + project.id)),
        )
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<Project | null> {
    return this.read(this.prefix + id)
  }

  async save(project: Project): Promise<Project> {
    const saved = { ...project, updatedAt: new Date().toISOString() }
    this.write(this.prefix + project.id, saved)
    return saved
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(this.prefix + id)
    localStorage.removeItem(this.publishedPrefix + id)
  }

  async publish(project: Project): Promise<void> {
    this.write(this.publishedPrefix + project.id, project)
  }

  async published(id: string): Promise<Project | null> {
    return this.read(this.publishedPrefix + id)
  }

  private keys(prefix: string): string[] {
    const keys: string[] = []
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        if (key?.startsWith(prefix)) keys.push(key)
      }
    } catch {
      /* storage unavailable */
    }
    return keys
  }

  private has(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null
    } catch {
      return false
    }
  }

  private read(key: string): Project | null {
    try {
      const json = localStorage.getItem(key)
      return json ? normalizeProject(JSON.parse(json)) : null
    } catch {
      return null
    }
  }

  private write(key: string, project: Project): void {
    try {
      localStorage.setItem(key, JSON.stringify(project))
    } catch {
      throw new Error(
        'Browser storage is full or unavailable. Export the project to keep a copy.',
      )
    }
  }

  /** Imports the single project saved by the first version of the builder. */
  private migrateLegacy(): void {
    try {
      const legacy = localStorage.getItem('page-studio-project')
      if (!legacy) return
      const project = migrateV1(JSON.parse(legacy))
      this.write(this.prefix + project.id, normalizeProject(project))
      localStorage.removeItem('page-studio-project')
    } catch {
      /* leave legacy data untouched if it cannot be read */
    }
  }
}

interface Envelope<T> {
  data: T
  status: number
  message: string
}

/** Stores projects in web-builder-service. */
@Injectable()
export class ApiProjectRepository extends ProjectRepository {
  readonly location = 'server' as const
  private readonly http = inject(HttpClient)
  private readonly base = `${inject(BUILDER_CONFIG).apiBaseUrl.replace(/\/+$/, '')}/web-builder/projects`

  private async call<T>(request: Promise<Envelope<T>>): Promise<T> {
    const response = await request
    if (!response || response.status >= 400 || response.message === 'Failed') {
      const detail = (response?.data as { message?: string | string[] } | null)
        ?.message
      throw new Error(
        Array.isArray(detail)
          ? detail.join(' ')
          : detail || 'The server rejected the request.',
      )
    }
    return response.data
  }

  list(): Promise<ProjectSummary[]> {
    return this.call(
      firstValueFrom(this.http.get<Envelope<ProjectSummary[]>>(this.base)),
    )
  }

  async get(id: string): Promise<Project | null> {
    const project = await this.call(
      firstValueFrom(
        this.http.get<Envelope<Project | null>>(
          `${this.base}/${encodeURIComponent(id)}`,
        ),
      ),
    )
    return project ? normalizeProject(project) : null
  }

  async save(project: Project): Promise<Project> {
    return normalizeProject(
      await this.call(
        firstValueFrom(
          this.http.put<Envelope<Project>>(
            `${this.base}/${encodeURIComponent(project.id)}`,
            project,
          ),
        ),
      ),
    )
  }

  async remove(id: string): Promise<void> {
    await this.call(
      firstValueFrom(
        this.http.delete<Envelope<unknown>>(
          `${this.base}/${encodeURIComponent(id)}`,
        ),
      ),
    )
  }

  async publish(project: Project): Promise<void> {
    await this.call(
      firstValueFrom(
        this.http.post<Envelope<unknown>>(
          `${this.base}/${encodeURIComponent(project.id)}/publish`,
          project,
        ),
      ),
    )
  }

  async published(id: string): Promise<Project | null> {
    const project = await this.call(
      firstValueFrom(
        this.http.get<Envelope<Project | null>>(
          `${this.base}/${encodeURIComponent(id)}/published`,
        ),
      ),
    )
    return project ? normalizeProject(project) : null
  }
}

export function provideProjectRepository() {
  return {
    provide: ProjectRepository,
    useFactory: () =>
      inject(BUILDER_CONFIG).apiBaseUrl
        ? new ApiProjectRepository()
        : new BrowserProjectRepository(),
  }
}

export function newProject(name?: string): Project {
  return createProject(name)
}
