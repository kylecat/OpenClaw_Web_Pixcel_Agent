import type { PlantStage } from '../greenhouse.service.js'

export class UpdatePlantDto {
  plantType?: string
  stage?: PlantStage
  plantedDate?: string
  expectedHarvest?: string
  notes?: string
  references?: string[]
}
