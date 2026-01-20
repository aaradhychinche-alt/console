// Cloud provider icons as SVG components
import React from 'react'

export type CloudProvider = 'eks' | 'gke' | 'aks' | 'openshift' | 'oci' | 'alibaba' | 'digitalocean' | 'rancher' | 'kind' | 'minikube' | 'k3s' | 'kubernetes'

interface CloudProviderIconProps {
  provider: CloudProvider
  size?: number
  className?: string
}

// AWS icon - orange square with white AWS text/smile
const AWSIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#FF9900" />
    <path d="M8.5 14.5c.3.8 1 1.5 2 1.5 1.5 0 2.5-1 2.5-2.5h1c0 2-1.5 3.5-3.5 3.5-1.5 0-2.7-.8-3.3-2h1.3z" fill="#252F3E" />
    <path d="M7 11.5L8 8.5h1l1 3M9 11h-1.5" stroke="#252F3E" strokeWidth="1" fill="none" />
    <path d="M12 8.5l1 3 1-3" stroke="#252F3E" strokeWidth="1" fill="none" />
    <path d="M16 8.5v3c0 .5-.5 1-1 1" stroke="#252F3E" strokeWidth="1" fill="none" />
  </svg>
)

// Google Cloud icon - multicolor G
const GCPIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <circle cx="12" cy="12" r="10" fill="#4285F4" />
    <path d="M17.4 10.4h-5.2v3.2h3c-.3 1.5-1.5 2.4-3 2.4-1.8 0-3.3-1.5-3.3-3.3 0-1.8 1.5-3.3 3.3-3.3 1 0 1.8.4 2.4 1l2.2-2.2C15.4 7 13.8 6 12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6c3 0 5.6-2.2 5.6-5.6 0-.4 0-.8-.1-1.1l-.1-.9z" fill="white" />
  </svg>
)

// Azure icon - blue square
const AzureIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#0078D4" />
    <path d="M7 6h4l-5 11h4l6-11h-4l1.5-3H7z" fill="white" fillOpacity="0.9" />
    <path d="M13 8l-3 8h5l-6 3 7-11z" fill="white" />
  </svg>
)

// OpenShift icon - official logo: red O with two horizontal offset bars
const OpenShiftIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    {/* Top horizontal bar with slight tilt */}
    <rect x="5" y="28" width="90" height="12" rx="2" fill="#EE0000" transform="rotate(-10 50 34)" />
    {/* Bottom horizontal bar with slight tilt */}
    <rect x="5" y="60" width="90" height="12" rx="2" fill="#EE0000" transform="rotate(-10 50 66)" />
    {/* Main red O ring */}
    <circle cx="50" cy="50" r="35" fill="#EE0000" />
    {/* White center hole */}
    <circle cx="50" cy="50" r="18" fill="white" />
    {/* Darker overlap areas on top bar */}
    <path d="M15 28 L38 28 L38 40 L15 40 Z" fill="#C00000" transform="rotate(-10 50 34)" />
    <path d="M62 28 L85 28 L85 40 L62 40 Z" fill="#C00000" transform="rotate(-10 50 34)" />
    {/* Darker overlap areas on bottom bar */}
    <path d="M15 60 L38 60 L38 72 L15 72 Z" fill="#C00000" transform="rotate(-10 50 66)" />
    <path d="M62 60 L85 60 L85 72 L62 72 Z" fill="#C00000" transform="rotate(-10 50 66)" />
  </svg>
)

// Oracle Cloud icon - red with O
const OCIIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#C74634" />
    <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" fill="none" />
  </svg>
)

// Alibaba Cloud icon - orange
const AlibabaIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#FF6A00" />
    <path d="M6 10h5v1H6v-1zM13 10h5v1h-5v-1zM6 13h5v1H6v-1zM13 13h5v1h-5v-1z" fill="white" />
    <circle cx="12" cy="12" r="2" fill="white" />
  </svg>
)

// DigitalOcean icon - blue droplet
const DigitalOceanIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <circle cx="12" cy="12" r="10" fill="#0080FF" />
    <path d="M12 17v-3h-3v-3c0-2.8 2.2-5 5-5 2.8 0 5 2.2 5 5h-4v3h-3v3z" fill="white" />
    <rect x="6" y="14" width="3" height="3" fill="white" />
    <rect x="6" y="17" width="3" height="2" fill="white" />
  </svg>
)

// Rancher icon - blue with cow
const RancherIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#0075A8" />
    <ellipse cx="12" cy="13" rx="5" ry="4" fill="white" />
    <ellipse cx="9" cy="12" rx="1" ry="1.5" fill="#0075A8" />
    <ellipse cx="15" cy="12" rx="1" ry="1.5" fill="#0075A8" />
    <path d="M8 8c-1-1-2-1-2 0s1 2 2 2" stroke="white" strokeWidth="1.5" fill="none" />
    <path d="M16 8c1-1 2-1 2 0s-1 2-2 2" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
)

// Kind icon - docker whale in circle
const KindIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <circle cx="12" cy="12" r="10" fill="#2496ED" />
    <path d="M6 13h2v2H6zM9 11h2v4H9zM12 10h2v5h-2zM15 12h2v3h-2z" fill="white" />
    <ellipse cx="12" cy="16" rx="7" ry="2" fill="white" fillOpacity="0.3" />
  </svg>
)

// Minikube icon - blue hexagon
const MinikubeIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <polygon points="12,2 22,7 22,17 12,22 2,17 2,7" fill="#326CE5" />
    <text x="12" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">m</text>
  </svg>
)

// K3s icon - yellow/green
const K3sIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
    <rect width="24" height="24" rx="4" fill="#FFC61C" />
    <text x="12" y="16" textAnchor="middle" fill="#1A1A1A" fontSize="10" fontWeight="bold">k3s</text>
  </svg>
)

// Kubernetes icon - official logo from Wikimedia Commons
const KubernetesIcon: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg viewBox="0 0 722.9 702" width={size} height={size} className={className}>
    {/* Blue heptagon background */}
    <path
      fill="#326ce5"
      d="M358.986 10.06a46.725 46.342 0 0 0-17.906 4.532L96.736 131.34a46.725 46.342 0 0 0-25.281 31.438L11.174 425.03a46.725 46.342 0 0 0 6.344 35.53 46.725 46.342 0 0 0 2.656 3.688l169.125 210.281a46.725 46.342 0 0 0 36.531 17.438l271.219-.063a46.725 46.342 0 0 0 36.531-17.406l169.031-210.312a46.725 46.342 0 0 0 9.031-39.219l-60.374-262.25a46.725 46.342 0 0 0-25.282-31.437L381.642 14.592a46.725 46.342 0 0 0-22.656-4.531z"
    />
    {/* White helm wheel */}
    <path
      fill="#fff"
      d="M361.407 99.307c-8.077 0-14.626 7.276-14.625 16.25 0 .138.028.27.031.406-.012 1.22-.07 2.689-.031 3.75.193 5.176 1.32 9.138 2 13.907 1.23 10.206 2.261 18.667 1.625 26.53-.619 2.966-2.803 5.678-4.75 7.563l-.344 6.188c-8.777.727-17.612 2.058-26.437 4.062-37.975 8.622-70.67 28.183-95.563 54.594-1.615-1.102-4.44-3.13-5.281-3.75-2.611.352-5.25 1.158-8.687-.844-6.545-4.406-12.506-10.487-19.72-17.812-3.304-3.504-5.697-6.841-9.624-10.22-.892-.766-2.253-1.804-3.25-2.593-3.07-2.448-6.691-3.724-10.188-3.844-4.496-.154-8.824 1.604-11.656 5.156-5.035 6.316-3.423 15.968 3.594 21.563.071.057.147.1.218.156.965.782 2.145 1.783 3.032 2.438 4.167 3.076 7.973 4.651 12.125 7.093 8.747 5.402 15.998 9.881 21.75 15.282 2.246 2.394 2.638 6.613 2.937 8.437l4.688 4.188c-25.094 37.763-36.707 84.409-29.844 131.937l-6.125 1.781c-1.614 2.085-3.895 5.365-6.281 6.344-7.525 2.37-15.994 3.24-26.219 4.312-4.8.4-8.942.161-14.031 1.125-1.12.213-2.68.619-3.906.907-.043.008-.082.021-.125.03-.067.016-.155.049-.219.063-8.62 2.083-14.158 10.006-12.375 17.813 1.783 7.808 10.203 12.556 18.875 10.687.063-.014.154-.017.219-.031.098-.022.184-.07.281-.094 1.21-.265 2.724-.56 3.782-.843 5.003-1.34 8.627-3.308 13.125-5.032 9.677-3.47 17.691-6.37 25.5-7.5 3.261-.255 6.697 2.012 8.406 2.97l6.375-1.095c14.67 45.483 45.414 82.245 84.344 105.313l-2.656 6.375c.957 2.475 2.013 5.824 1.3 8.269-2.838 7.361-7.7 15.13-13.237 23.793-2.681 4.002-5.425 7.108-7.844 11.688-.579 1.096-1.316 2.779-1.875 3.937-3.759 8.043-1.002 17.306 6.219 20.782 7.266 3.497 16.284-.192 20.187-8.25.006-.012.026-.02.032-.032.004-.008-.004-.022 0-.03.556-1.143 1.343-2.645 1.812-3.72 2.072-4.746 2.762-8.814 4.219-13.405 3.87-9.72 5.996-19.92 11.323-26.275 1.458-1.74 3.836-2.409 6.302-3.069l3.312-6c33.939 13.027 71.927 16.522 109.875 7.906 8.657-1.966 17.015-4.51 25.094-7.562.931 1.651 2.661 4.826 3.125 5.625 2.506.815 5.24 1.236 7.469 4.531 3.985 6.809 6.71 14.864 10.03 24.594 1.458 4.591 2.178 8.659 4.25 13.406.473 1.082 1.256 2.605 1.813 3.75 3.895 8.085 12.942 11.787 20.219 8.281 7.22-3.478 9.98-12.74 6.218-20.781-.558-1.158-1.327-2.842-1.906-3.937-2.42-4.58-5.162-7.655-7.844-11.657-5.537-8.661-10.13-15.857-12.968-23.218-1.188-3.797.2-6.158 1.125-8.625-.554-.635-1.739-4.22-2.438-5.907 40.458-23.888 70.299-62.021 84.313-106.062 1.892.297 5.181.879 6.25 1.093 2.2-1.45 4.222-3.343 8.188-3.03 7.808 1.128 15.822 4.029 25.5 7.5 4.498 1.722 8.121 3.722 13.125 5.062 1.057.283 2.572.547 3.78.813.098.024.184.07.282.093.065.015.156.017.219.032 8.672 1.867 17.094-2.879 18.875-10.688 1.78-7.807-3.754-15.732-12.375-17.812-1.254-.285-3.032-.77-4.25-1-5.09-.964-9.231-.726-14.031-1.125-10.225-1.072-18.694-1.943-26.22-4.313-3.067-1.19-5.25-4.84-6.312-6.343l-5.906-1.72c3.062-22.153 2.237-45.21-3.062-68.28-5.349-23.285-14.8-44.581-27.407-63.344 1.515-1.377 4.376-3.911 5.188-4.656.237-2.624.033-5.376 2.75-8.281 5.751-5.401 13.003-9.88 21.75-15.282 4.151-2.442 7.99-4.016 12.156-7.093.942-.696 2.229-1.798 3.219-2.594 7.015-5.596 8.63-15.248 3.594-21.562-5.037-6.314-14.798-6.91-21.813-1.313-.999.79-2.354 1.823-3.25 2.594-3.927 3.378-6.352 6.714-9.657 10.219-7.212 7.326-13.173 13.437-19.718 17.844-2.836 1.65-6.99 1.08-8.875.968l-5.563 3.97c-31.718-33.262-74.904-54.526-121.406-58.657-.13-1.949-.3-5.471-.343-6.531-1.904-1.822-4.204-3.377-4.782-7.313-.636-7.864.426-16.324 1.656-26.531.68-4.769 1.808-8.73 2-13.906.044-1.177-.026-2.884-.03-4.156-.002-8.975-6.549-16.251-14.626-16.25zm-18.312 113.437l-4.344 76.72-.312.155c-.292 6.864-5.94 12.344-12.875 12.344-2.841 0-5.463-.912-7.594-2.469l-.125.063-62.906-44.594c19.333-19.011 44.063-33.06 72.562-39.531 5.206-1.182 10.41-2.06 15.594-2.688zm36.656 0c33.273 4.093 64.045 19.16 87.625 42.25l-62.5 44.313-.218-.094c-5.548 4.051-13.364 3.046-17.688-2.375-1.771-2.221-2.7-4.832-2.812-7.469l-.063-.031zm-147.625 70.875l57.438 51.375-.063.312c5.184 4.507 5.95 12.328 1.625 17.75-1.771 2.222-4.142 3.711-6.687 4.407l-.063.25-73.625 21.25c-3.747-34.266 4.33-67.574 21.375-95.344zm258.156.031c8.534 13.833 14.997 29.282 18.844 46.031 3.8 16.549 4.755 33.067 3.187 49.032l-74-21.313-.062-.312c-6.627-1.811-10.7-8.552-9.157-15.313.632-2.77 2.103-5.113 4.094-6.844l-.031-.156 57.125-51.125zm-140.656 55.312l23.53 0 14.626 18.282-5.25 22.812-21.125 10.156-21.188-10.187-5.25-22.813zm75.438 62.563c1-.05 1.995.04 2.968.219l.125-.156 76.157 12.875c-11.146 31.313-32.473 58.44-60.97 76.593l-29.562-71.406.094-.125c-2.716-6.31.002-13.71 6.25-16.719 1.6-.77 3.27-1.197 4.938-1.281zm-127.907.312c5.812.082 11.025 4.116 12.375 10.031.632 2.77.325 5.514-.719 7.938l.22.281-29.25 70.688c-27.348-17.549-49.13-43.825-60.782-76.063l75.5-12.812.125.156c.845-.156 1.701-.23 2.531-.22zm63.782 30.969c2.024-.074 4.078.341 6.03 1.281 2.56 1.233 4.538 3.173 5.782 5.5l.281 0 37.219 67.25c-4.83 1.62-9.796 3.004-14.875 4.157-28.465 6.462-56.839 4.504-82.531-4.25l37.125-67.126.062 0c2.228-4.164 6.453-6.648 10.907-6.812z"
    />
  </svg>
)

export function CloudProviderIcon({ provider, size = 16, className }: CloudProviderIconProps) {
  const iconProps = { size, className }

  switch (provider) {
    case 'eks':
      return <AWSIcon {...iconProps} />
    case 'gke':
      return <GCPIcon {...iconProps} />
    case 'aks':
      return <AzureIcon {...iconProps} />
    case 'openshift':
      return <OpenShiftIcon {...iconProps} />
    case 'oci':
      return <OCIIcon {...iconProps} />
    case 'alibaba':
      return <AlibabaIcon {...iconProps} />
    case 'digitalocean':
      return <DigitalOceanIcon {...iconProps} />
    case 'rancher':
      return <RancherIcon {...iconProps} />
    case 'kind':
      return <KindIcon {...iconProps} />
    case 'minikube':
      return <MinikubeIcon {...iconProps} />
    case 'k3s':
      return <K3sIcon {...iconProps} />
    case 'kubernetes':
    default:
      return <KubernetesIcon {...iconProps} />
  }
}

export function getProviderLabel(provider: CloudProvider): string {
  switch (provider) {
    case 'eks': return 'AWS EKS'
    case 'gke': return 'Google GKE'
    case 'aks': return 'Azure AKS'
    case 'openshift': return 'OpenShift'
    case 'oci': return 'Oracle OKE'
    case 'alibaba': return 'Alibaba ACK'
    case 'digitalocean': return 'DigitalOcean'
    case 'rancher': return 'Rancher'
    case 'kind': return 'Kind'
    case 'minikube': return 'Minikube'
    case 'k3s': return 'K3s'
    default: return 'Kubernetes'
  }
}

// Get the primary brand color for each provider (for borders, accents, etc.)
export function getProviderColor(provider: CloudProvider): string {
  switch (provider) {
    case 'eks': return '#FF9900'         // AWS Orange
    case 'gke': return '#4285F4'         // Google Blue
    case 'aks': return '#0078D4'         // Azure Blue
    case 'openshift': return '#EE0000'   // Red Hat Red
    case 'oci': return '#C74634'         // Oracle Red
    case 'alibaba': return '#FF6A00'     // Alibaba Orange
    case 'digitalocean': return '#0080FF' // DO Blue
    case 'rancher': return '#0075A8'     // Rancher Blue
    case 'kind': return '#2496ED'        // Docker Blue
    case 'minikube': return '#326CE5'    // K8s Blue
    case 'k3s': return '#FFC61C'         // K3s Yellow
    default: return '#326CE5'            // Kubernetes Blue
  }
}

// Get Tailwind border class for provider (for use in className)
export function getProviderBorderClass(provider: CloudProvider): string {
  switch (provider) {
    case 'eks': return 'border-orange-500/40'
    case 'gke': return 'border-blue-500/40'
    case 'aks': return 'border-cyan-500/40'
    case 'openshift': return 'border-red-500/40'
    case 'oci': return 'border-red-600/40'
    case 'alibaba': return 'border-orange-500/40'
    case 'digitalocean': return 'border-blue-400/40'
    case 'rancher': return 'border-cyan-600/40'
    case 'kind': return 'border-blue-400/40'
    case 'minikube': return 'border-blue-500/40'
    case 'k3s': return 'border-yellow-500/40'
    default: return 'border-blue-500/40'
  }
}

// Get console URL for cloud providers
export function getConsoleUrl(provider: CloudProvider, clusterName: string, apiServerUrl?: string): string | null {
  const serverUrl = apiServerUrl?.toLowerCase() || ''

  switch (provider) {
    case 'eks': {
      const urlRegionMatch = serverUrl.match(/\.([a-z]{2}-[a-z]+-\d)\.eks\.amazonaws\.com/)
      if (urlRegionMatch) {
        return `https://${urlRegionMatch[1]}.console.aws.amazon.com/eks/home?region=${urlRegionMatch[1]}#/clusters`
      }
      const nameRegionMatch = clusterName.match(/([a-z]{2}-[a-z]+-\d)/)
      if (nameRegionMatch) {
        return `https://${nameRegionMatch[1]}.console.aws.amazon.com/eks/home?region=${nameRegionMatch[1]}#/clusters`
      }
      return 'https://console.aws.amazon.com/eks/home#/clusters'
    }
    case 'gke':
      return 'https://console.cloud.google.com/kubernetes/list/overview'
    case 'aks':
      return 'https://portal.azure.com/#view/HubsExtension/BrowseResource/resourceType/Microsoft.ContainerService%2FmanagedClusters'
    case 'openshift': {
      // Handle URLs with or without protocol prefix
      const apiMatch = apiServerUrl?.match(/(?:https?:\/\/)?api\.([^:\/]+)/)
      if (apiMatch) {
        return `https://console-openshift-console.apps.${apiMatch[1]}`
      }
      return null
    }
    case 'oci': {
      const regionMatch = serverUrl.match(/\.([a-z]+-[a-z]+-\d)\.clusters\.oci/)
      if (regionMatch) {
        return `https://cloud.oracle.com/containers/clusters?region=${regionMatch[1]}`
      }
      return 'https://cloud.oracle.com/containers/clusters?region=us-ashburn-1'
    }
    case 'alibaba':
      return 'https://cs.console.aliyun.com/#/k8s/cluster/list'
    case 'digitalocean':
      return 'https://cloud.digitalocean.com/kubernetes/clusters'
    default:
      return null
  }
}

// Provider detection from cluster name, API server URL, user, and optionally namespaces
// Priority: 1. Namespace-based (most accurate), 2. Name-based, 3. User-based, 4. URL-based
export function detectCloudProvider(
  clusterName: string,
  apiServerUrl?: string,
  namespaces?: string[],
  userName?: string
): CloudProvider {
  const name = clusterName.toLowerCase()
  const serverUrl = apiServerUrl?.toLowerCase() || ''
  const user = userName?.toLowerCase() || ''

  // Check namespace-based patterns FIRST (most accurate when available)
  if (namespaces && namespaces.length > 0) {
    const nsLower = namespaces.map(ns => ns.toLowerCase())

    // OpenShift - has openshift-* namespaces
    if (nsLower.some(ns => ns.startsWith('openshift-') || ns === 'openshift')) {
      return 'openshift'
    }
    // EKS - has aws-observability or amazon-* namespaces
    if (nsLower.some(ns => ns.startsWith('aws-') || ns.startsWith('amazon-') || ns === 'amazon-cloudwatch')) {
      return 'eks'
    }
    // GKE - has gke-* or config-management-system namespaces
    if (nsLower.some(ns => ns.startsWith('gke-') || ns === 'config-management-system' || ns === 'gke-managed-filestorecsi')) {
      return 'gke'
    }
    // AKS - has azure-* namespaces or kube-node-lease with azure annotations
    if (nsLower.some(ns => ns.startsWith('azure-') || ns === 'azure-arc')) {
      return 'aks'
    }
    // OCI - has oci-* or oraclecloud-* namespaces
    if (nsLower.some(ns => ns.startsWith('oci-') || ns.startsWith('oraclecloud-'))) {
      return 'oci'
    }
    // Rancher - has cattle-system or rancher namespaces
    if (nsLower.some(ns => ns === 'cattle-system' || ns === 'cattle-fleet-system' || ns.startsWith('cattle-'))) {
      return 'rancher'
    }
    // K3s - has k3s-system namespace
    if (nsLower.some(ns => ns === 'k3s-system')) {
      return 'k3s'
    }
  }

  // Check name-based patterns (second priority)
  // Oracle OCI OKE - check name first since "oci" in name is definitive
  if (name.includes('oci') || name.includes('oke') || name.includes('oracle')) {
    return 'oci'
  }
  // AWS EKS by name
  if (name.includes('eks') || name.includes('aws') || name.match(/arn:aws:/)) {
    return 'eks'
  }
  // Google GKE by name
  if (name.includes('gke') || name.includes('gcp') || name.includes('google')) {
    return 'gke'
  }
  // Azure AKS by name
  if (name.includes('aks') || name.includes('azure')) {
    return 'aks'
  }
  // OpenShift by name (explicit indicators)
  if (name.includes('openshift') || name.includes('ocp') || name.includes('rosa')) {
    return 'openshift'
  }
  // Alibaba Cloud ACK by name
  if (name.includes('alibaba') || name.includes('aliyun') || name.includes('ack')) {
    return 'alibaba'
  }
  // DigitalOcean by name
  if (name.includes('digitalocean') || name.includes('do-') || name.includes('doks')) {
    return 'digitalocean'
  }
  // Rancher by name
  if (name.includes('rancher')) return 'rancher'
  // Local development clusters by name
  if (name.includes('kind')) return 'kind'
  if (name.includes('minikube')) return 'minikube'
  if (name.includes('k3s') || name.includes('k3d')) return 'k3s'

  // Check URL-based patterns (fallback for when name doesn't help)
  // AWS EKS by URL
  if (serverUrl.includes('.eks.amazonaws.com')) {
    return 'eks'
  }
  // Google GKE by URL
  if (serverUrl.includes('container.googleapis.com') || serverUrl.includes('.container.cloud.google.com') || serverUrl.includes('gke.io')) {
    return 'gke'
  }
  // Azure AKS by URL
  if (serverUrl.includes('.azmk8s.io')) {
    return 'aks'
  }
  // Oracle OCI by URL
  if (serverUrl.includes('.oraclecloud.com')) {
    return 'oci'
  }
  // Alibaba Cloud by URL
  if (serverUrl.includes('.aliyuncs.com')) {
    return 'alibaba'
  }
  // DigitalOcean by URL
  if (serverUrl.includes('.digitalocean.com') || serverUrl.includes('k8s.ondigitalocean')) {
    return 'digitalocean'
  }
  // OpenShift by URL - check for specific OpenShift domains (NOT just :6443 port)
  if (serverUrl.includes('openshift.com') || serverUrl.includes('openshiftapps.com') || serverUrl.includes('.openshift.')) {
    return 'openshift'
  }

  // Check user-based patterns (OKE generates user names like "user-chbezebxx3a")
  // OKE user pattern: user-[lowercase_alphanumeric_10-12_chars]
  if (user.match(/^user-[a-z0-9]{10,12}$/)) {
    return 'oci'
  }

  return 'kubernetes'
}
