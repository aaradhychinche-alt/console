export interface ArtifactHubDemoData {
  repositoryCount: number
  packageCount: number
  health: 'healthy' | 'degraded'
  lastSyncTime: string
}

// Representative sample numbers based on Artifact Hub public statistics
export const ARTIFACT_HUB_DEMO_DATA: ArtifactHubDemoData = {
  repositoryCount: 342,
  packageCount: 14_821,
  health: 'healthy',
  lastSyncTime: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 minutes ago
}
