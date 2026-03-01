export enum AgentStatus {
  IDLE             = 'IDLE',
  THINKING         = 'THINKING',
  TALKING          = 'TALKING',
  NETWORK_UNSTABLE = 'NETWORK_UNSTABLE',
  ERROR            = 'ERROR',
  CRASHED          = 'CRASHED',
  DONE             = 'DONE',
}

export const STATUS_EMOJI: Record<AgentStatus, string> = {
  [AgentStatus.IDLE]:             '😶',
  [AgentStatus.THINKING]:         '🤔',
  [AgentStatus.TALKING]:          '💬',
  [AgentStatus.NETWORK_UNSTABLE]: '📶',
  [AgentStatus.ERROR]:            '❌',
  [AgentStatus.CRASHED]:          '💥',
  [AgentStatus.DONE]:             '✅',
}
