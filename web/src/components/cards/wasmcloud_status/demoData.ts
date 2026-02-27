/**
 * Demo data for the wasmCloud status card.
 *
 * Representative of a small multi-cluster environment running wasmCloud.
 * Used when the dashboard is in demo mode or no wasmCloud hosts are available.
 */

export interface WasmCloudHost {
    id: string
    cluster: string
    version: string
    uptime: string
    status: 'healthy' | 'degraded' | 'unreachable'
    actors: number
    providers: number
    natsUrl: string
    labels: Record<string, string>
}

export interface WasmCloudActor {
    id: string
    name: string
    hostId: string
    cluster: string
    instances: number
    capabilities: string[]
    status: 'running' | 'stopped' | 'failed'
}

export interface WasmCloudDemoData {
    hosts: WasmCloudHost[]
    actors: WasmCloudActor[]
    lastCheckTime: string
}

export const WASMCLOUD_DEMO_DATA: WasmCloudDemoData = {
    hosts: [
        {
            id: 'Nxyz1-host-prod-01',
            cluster: 'prod-us-east',
            version: '1.4.0',
            uptime: '14d 6h',
            status: 'healthy',
            actors: 8,
            providers: 3,
            natsUrl: 'nats://nats.prod:4222',
            labels: { env: 'production', region: 'us-east-1' },
        },
        {
            id: 'Nxyz2-host-prod-02',
            cluster: 'prod-us-east',
            version: '1.4.0',
            uptime: '14d 6h',
            status: 'healthy',
            actors: 5,
            providers: 3,
            natsUrl: 'nats://nats.prod:4222',
            labels: { env: 'production', region: 'us-east-1' },
        },
        {
            id: 'Nxyz3-host-staging-01',
            cluster: 'staging-eu',
            version: '1.3.2',
            uptime: '3d 12h',
            status: 'healthy',
            actors: 4,
            providers: 2,
            natsUrl: 'nats://nats.staging:4222',
            labels: { env: 'staging', region: 'eu-west-1' },
        },
        {
            id: 'Nxyz4-host-dev-01',
            cluster: 'dev-local',
            version: '1.4.0',
            uptime: '1d 2h',
            status: 'degraded',
            actors: 2,
            providers: 1,
            natsUrl: 'nats://localhost:4222',
            labels: { env: 'dev' },
        },
    ],
    actors: [
        {
            id: 'Mactor-http-server',
            name: 'HTTP Server',
            hostId: 'Nxyz1-host-prod-01',
            cluster: 'prod-us-east',
            instances: 3,
            capabilities: ['wasmcloud:httpserver'],
            status: 'running',
        },
        {
            id: 'Mactor-kv-counter',
            name: 'KV Counter',
            hostId: 'Nxyz1-host-prod-01',
            cluster: 'prod-us-east',
            instances: 2,
            capabilities: ['wasmcloud:keyvalue'],
            status: 'running',
        },
        {
            id: 'Mactor-echo',
            name: 'Echo Service',
            hostId: 'Nxyz2-host-prod-02',
            cluster: 'prod-us-east',
            instances: 1,
            capabilities: ['wasmcloud:httpserver'],
            status: 'running',
        },
        {
            id: 'Mactor-messaging',
            name: 'Messaging Bridge',
            hostId: 'Nxyz3-host-staging-01',
            cluster: 'staging-eu',
            instances: 2,
            capabilities: ['wasmcloud:messaging'],
            status: 'running',
        },
        {
            id: 'Mactor-blob-store',
            name: 'Blob Store',
            hostId: 'Nxyz3-host-staging-01',
            cluster: 'staging-eu',
            instances: 1,
            capabilities: ['wasmcloud:blobstore'],
            status: 'stopped',
        },
        {
            id: 'Mactor-logger',
            name: 'Logger',
            hostId: 'Nxyz4-host-dev-01',
            cluster: 'dev-local',
            instances: 1,
            capabilities: ['wasmcloud:logging'],
            status: 'failed',
        },
    ],
    lastCheckTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
}
