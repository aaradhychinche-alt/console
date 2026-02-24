// Package handlers provides HTTP handlers for the console API.
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/kubestellar/console/pkg/k8s"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// bareMetalHostGVR is the GroupVersionResource for Metal3 BareMetalHost CRDs.
var bareMetalHostGVR = schema.GroupVersionResource{
	Group:    "metal3.io",
	Version:  "v1alpha1",
	Resource: "baremetalhosts",
}

// Metal3HostSummary is the JSON shape returned to the frontend.
type Metal3HostSummary struct {
	Hosts []metal3HostItem `json:"hosts"`
}

// metal3HostItem holds the fields the frontend hook consumes per host.
type metal3HostItem struct {
	Provisioning *metal3Provisioning `json:"provisioning,omitempty"`
	Conditions   []metal3Condition   `json:"conditions,omitempty"`
}

type metal3Provisioning struct {
	State string `json:"state,omitempty"`
}

type metal3Condition struct {
	Type   string `json:"type,omitempty"`
	Status string `json:"status,omitempty"`
}

// Metal3Handlers provides the /api/proxy/metal3/hosts endpoint.
type Metal3Handlers struct {
	k8sClient *k8s.MultiClusterClient
}

// NewMetal3Handlers creates a handler that talks to the k8s client.
func NewMetal3Handlers(k8sClient *k8s.MultiClusterClient) *Metal3Handlers {
	return &Metal3Handlers{k8sClient: k8sClient}
}

// GetHosts lists BareMetalHost resources across all healthy clusters and
// returns the aggregated list to the frontend.
func (h *Metal3Handlers) GetHosts(c *fiber.Ctx) error {
	if h.k8sClient == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "no cluster access available",
		})
	}

	clusters, _, err := h.k8sClient.HealthyClusters(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to list clusters: %v", err),
		})
	}

	var (
		mu    sync.Mutex
		wg    sync.WaitGroup
		hosts []metal3HostItem
	)

	for _, cl := range clusters {
		wg.Add(1)
		go func(clusterName string) {
			defer wg.Done()

			ctx, cancel := context.WithTimeout(c.Context(), mcpDefaultTimeout)
			defer cancel()

			dynClient, err := h.k8sClient.GetDynamicClient(clusterName)
			if err != nil {
				return
			}

			list, err := dynClient.Resource(bareMetalHostGVR).
				Namespace("").
				List(ctx, metav1.ListOptions{})
			if err != nil {
				// CRD not installed on this cluster — skip silently.
				if errors.IsNotFound(err) || errors.IsMethodNotSupported(err) {
					return
				}
				return
			}

			for _, item := range list.Items {
				h := metal3HostItem{}

				// Extract provisioning state
				if statusObj, ok := item.Object["status"].(map[string]interface{}); ok {
					if provObj, ok := statusObj["provisioning"].(map[string]interface{}); ok {
						if state, ok := provObj["state"].(string); ok {
							h.Provisioning = &metal3Provisioning{State: state}
						}
					}
				}

				// Extract conditions
				if statusObj, ok := item.Object["status"].(map[string]interface{}); ok {
					if condRaw, ok := statusObj["conditions"].([]interface{}); ok {
						for _, cr := range condRaw {
							condMap, ok := cr.(map[string]interface{})
							if !ok {
								continue
							}
							cond := metal3Condition{}
							if t, ok := condMap["type"].(string); ok {
								cond.Type = t
							}
							if s, ok := condMap["status"].(string); ok {
								cond.Status = s
							}
							h.Conditions = append(h.Conditions, cond)
						}
					}
				}

				mu.Lock()
				hosts = append(hosts, h)
				mu.Unlock()
			}
		}(cl.Name)
	}

	waitWithDeadline(&wg, maxResponseDeadline)

	return c.JSON(Metal3HostSummary{Hosts: hosts})
}

// getDemoMetal3Hosts returns representative BareMetalHost demo data that
// mirrors the METAL3_DEMO_DATA constants in the frontend demoData.ts.
func getDemoMetal3Hosts() Metal3HostSummary {
	type stateEntry struct {
		state     string
		count     int
		bmcErrCnt int // how many of these have BMCAccessError=True
	}

	entries := []stateEntry{
		{state: "provisioned", count: 8, bmcErrCnt: 0},
		{state: "provisioning", count: 2, bmcErrCnt: 1},
		{state: "deprovisioned", count: 1, bmcErrCnt: 0},
		{state: "error", count: 1, bmcErrCnt: 1},
	}

	var hosts []metal3HostItem
	for _, e := range entries {
		for i := range e.count {
			conds := []metal3Condition{}
			if i < e.bmcErrCnt {
				conds = append(conds, metal3Condition{Type: "BMCAccessError", Status: "True"})
			}
			hosts = append(hosts, metal3HostItem{
				Provisioning: &metal3Provisioning{State: e.state},
				Conditions:   conds,
			})
		}
	}

	return Metal3HostSummary{Hosts: hosts}
}

// GetHostsDemo handles the demo-mode path for GetHosts. Exported for testing.
func (h *Metal3Handlers) GetHostsWithDemoCheck(c *fiber.Ctx) error {
	if isDemoMode(c) {
		demo := getDemoMetal3Hosts()
		b, _ := json.Marshal(demo)
		c.Set("Content-Type", "application/json")
		return c.Send(b)
	}
	return h.GetHosts(c)
}
