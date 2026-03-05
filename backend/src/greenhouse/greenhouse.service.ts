import { Injectable, NotFoundException } from '@nestjs/common'
import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

/* ------------------------------------------------------------------ */
/*  Domain interfaces                                                  */
/* ------------------------------------------------------------------ */

export type PlantStage = 'seed' | 'sprout' | 'growing' | 'harvest'

export interface PlantEntry {
  id: string
  plantType: string
  stage: PlantStage
  plantedDate: string
  expectedHarvest: string
  notes: string
  references: string[]
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

const DATA_DIR = join(process.cwd(), '..', 'data')
const GH_FILE = join(DATA_DIR, 'greenhouse.json')

@Injectable()
export class GreenhouseService {
  private entries: PlantEntry[] = []
  private loaded = false

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
    if (existsSync(GH_FILE)) {
      const raw = await readFile(GH_FILE, 'utf-8')
      this.entries = JSON.parse(raw) as PlantEntry[]
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
    await writeFile(GH_FILE, JSON.stringify(this.entries, null, 2), 'utf-8')
  }

  async findAll(): Promise<PlantEntry[]> {
    await this.ensureLoaded()
    return this.entries
  }

  async create(dto: Omit<PlantEntry, 'id'>): Promise<PlantEntry> {
    await this.ensureLoaded()
    const entry: PlantEntry = {
      id: `plant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...dto,
    }
    this.entries.push(entry)
    await this.persist()
    return entry
  }

  async update(id: string, dto: Partial<Omit<PlantEntry, 'id'>>): Promise<PlantEntry> {
    await this.ensureLoaded()
    const idx = this.entries.findIndex((e) => e.id === id)
    if (idx === -1) throw new NotFoundException(`Plant entry ${id} not found`)
    this.entries[idx] = { ...this.entries[idx], ...dto }
    await this.persist()
    return this.entries[idx]
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded()
    const idx = this.entries.findIndex((e) => e.id === id)
    if (idx === -1) throw new NotFoundException(`Plant entry ${id} not found`)
    this.entries.splice(idx, 1)
    await this.persist()
  }
}
