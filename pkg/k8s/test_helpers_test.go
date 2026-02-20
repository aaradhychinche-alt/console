package k8s

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// buildTestGVRMap returns the comprehensive GVR-to-ListKind map needed by
// fake dynamic clients when tests exercise dependency resolution, monitoring,
// or deploy logic that touches many resource types.
func buildTestGVRMap() map[schema.GroupVersionResource]string {
	return map[schema.GroupVersionResource]string{
		{Group: "apps", Version: "v1", Resource: "deployments"}:                                             "DeploymentList",
		{Group: "apps", Version: "v1", Resource: "statefulsets"}:                                            "StatefulSetList",
		{Group: "apps", Version: "v1", Resource: "daemonsets"}:                                              "DaemonSetList",
		{Group: "", Version: "v1", Resource: "services"}:                                                    "ServiceList",
		{Group: "", Version: "v1", Resource: "configmaps"}:                                                  "ConfigMapList",
		{Group: "", Version: "v1", Resource: "secrets"}:                                                     "SecretList",
		{Group: "", Version: "v1", Resource: "serviceaccounts"}:                                             "ServiceAccountList",
		{Group: "", Version: "v1", Resource: "persistentvolumeclaims"}:                                      "PersistentVolumeClaimList",
		{Group: "", Version: "v1", Resource: "namespaces"}:                                                  "NamespaceList",
		{Group: "", Version: "v1", Resource: "nodes"}:                                                       "NodeList",
		{Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"}:                                  "IngressList",
		{Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"}:                            "NetworkPolicyList",
		{Group: "autoscaling", Version: "v2", Resource: "horizontalpodautoscalers"}:                         "HorizontalPodAutoscalerList",
		{Group: "policy", Version: "v1", Resource: "poddisruptionbudgets"}:                                  "PodDisruptionBudgetList",
		{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"}:                              "RoleList",
		{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"}:                       "RoleBindingList",
		{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"}:                       "ClusterRoleList",
		{Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"}:                "ClusterRoleBindingList",
		{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}:               "CustomResourceDefinitionList",
		{Group: "admissionregistration.k8s.io", Version: "v1", Resource: "validatingwebhookconfigurations"}: "ValidatingWebhookConfigurationList",
		{Group: "admissionregistration.k8s.io", Version: "v1", Resource: "mutatingwebhookconfigurations"}:   "MutatingWebhookConfigurationList",
	}
}
