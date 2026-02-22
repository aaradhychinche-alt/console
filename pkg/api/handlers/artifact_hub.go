// Package handlers provides HTTP handlers for the console API.
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	artifactHubBase     = "https://artifacthub.io/api/v1"
	artifactHubCacheTTL = 5 * time.Minute
)

// ArtifactHubStats holds the aggregated stats from Artifact Hub.
type ArtifactHubStats struct {
	RepositoryCount int    `json:"repositoryCount"`
	PackageCount    int    `json:"packageCount"`
	Health          string `json:"health"` // "healthy" | "degraded"
	LastSyncTime    string `json:"lastSyncTime"`
}

// artifactHubSearchResponse is the typed shape of the Artifact Hub
// /repositories/search and /packages/search responses.
// Only the pagination.total field is consumed; all other fields are ignored.
type artifactHubSearchResponse struct {
	Pagination struct {
		Total int `json:"total"`
	} `json:"pagination"`
}

// ArtifactHubHandler proxies requests to the Artifact Hub public API and
// caches results server-side to avoid CORS restrictions and rate limits.
type ArtifactHubHandler struct {
	httpClient *http.Client

	mu       sync.RWMutex
	cache    *ArtifactHubStats
	cacheExp time.Time
}

// NewArtifactHubHandler creates a new handler with a shared HTTP client.
func NewArtifactHubHandler() *ArtifactHubHandler {
	return &ArtifactHubHandler{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// GetStats returns aggregated Artifact Hub stats (repository and package counts).
// Results are cached for 5 minutes.
func (h *ArtifactHubHandler) GetStats(c *fiber.Ctx) error {
	h.mu.RLock()
	if h.cache != nil && time.Now().Before(h.cacheExp) {
		result := *h.cache
		h.mu.RUnlock()
		return c.JSON(result)
	}
	h.mu.RUnlock()

	stats, err := h.fetchStats()
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to fetch Artifact Hub data: %v", err),
		})
	}

	h.mu.Lock()
	h.cache = stats
	h.cacheExp = time.Now().Add(artifactHubCacheTTL)
	h.mu.Unlock()

	return c.JSON(stats)
}

func (h *ArtifactHubHandler) fetchStats() (*ArtifactHubStats, error) {
	type fetchResult struct {
		resp *artifactHubSearchResponse
		err  error
	}

	reposCh := make(chan fetchResult, 1)
	pkgsCh := make(chan fetchResult, 1)

	go func() {
		data, err := h.getSearchResponse(artifactHubBase + "/repositories/search?limit=1")
		reposCh <- fetchResult{resp: data, err: err}
	}()
	go func() {
		data, err := h.getSearchResponse(artifactHubBase + "/packages/search?limit=1")
		pkgsCh <- fetchResult{resp: data, err: err}
	}()

	reposResult := <-reposCh
	pkgsResult := <-pkgsCh

	health := "healthy"
	if reposResult.err != nil || pkgsResult.err != nil {
		health = "degraded"
	}

	repositoryCount := 0
	if reposResult.err == nil && reposResult.resp != nil {
		repositoryCount = reposResult.resp.Pagination.Total
	}

	packageCount := 0
	if pkgsResult.err == nil && pkgsResult.resp != nil {
		packageCount = pkgsResult.resp.Pagination.Total
	}

	return &ArtifactHubStats{
		RepositoryCount: repositoryCount,
		PackageCount:    packageCount,
		Health:          health,
		LastSyncTime:    time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (h *ArtifactHubHandler) getSearchResponse(url string) (*artifactHubSearchResponse, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	var result artifactHubSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return &result, nil
}
