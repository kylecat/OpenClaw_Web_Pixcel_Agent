import type { PlantStage } from '../greenhouse.service.js'

export class CreatePlantDto {
  plantType!: string
  stage!: PlantStage
  plantedDate!: string
  expectedHarvest!: string
  notes!: string
  references!: string[]
}
