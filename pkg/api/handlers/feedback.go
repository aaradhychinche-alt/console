package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/kubestellar/console/pkg/api/middleware"
	"github.com/kubestellar/console/pkg/models"
	"github.com/kubestellar/console/pkg/store"
)

// FeedbackHandler handles feature requests and feedback
type FeedbackHandler struct {
	store         store.Store
	githubToken   string
	webhookSecret string
	repoOwner     string
	repoName      string
}

// FeedbackConfig holds configuration for the feedback handler
type FeedbackConfig struct {
	GitHubToken   string // PAT for creating issues
	WebhookSecret string // Secret for validating GitHub webhooks
	RepoOwner     string // GitHub org/owner (e.g., "kubestellar")
	RepoName      string // GitHub repo name (e.g., "console")
}

// NewFeedbackHandler creates a new feedback handler
func NewFeedbackHandler(s store.Store, cfg FeedbackConfig) *FeedbackHandler {
	return &FeedbackHandler{
		store:         s,
		githubToken:   cfg.GitHubToken,
		webhookSecret: cfg.WebhookSecret,
		repoOwner:     cfg.RepoOwner,
		repoName:      cfg.RepoName,
	}
}

// CreateFeatureRequest creates a new feature request and GitHub issue
func (h *FeedbackHandler) CreateFeatureRequest(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var input models.CreateFeatureRequestInput
	if err := c.BodyParser(&input); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Validate input
	if input.Title == "" || len(input.Title) < 5 {
		return fiber.NewError(fiber.StatusBadRequest, "Title must be at least 5 characters")
	}
	if input.Description == "" || len(input.Description) < 10 {
		return fiber.NewError(fiber.StatusBadRequest, "Description must be at least 10 characters")
	}
	if input.RequestType != models.RequestTypeBug && input.RequestType != models.RequestTypeFeature {
		return fiber.NewError(fiber.StatusBadRequest, "Request type must be 'bug' or 'feature'")
	}

	// Get user info for the issue
	user, err := h.store.GetUser(userID)
	if err != nil || user == nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get user")
	}

	// Create feature request in database first
	request := &models.FeatureRequest{
		UserID:      userID,
		Title:       input.Title,
		Description: input.Description,
		RequestType: input.RequestType,
		Status:      models.RequestStatusSubmitted,
	}

	if err := h.store.CreateFeatureRequest(request); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create feature request")
	}

	// Create GitHub issue
	if h.githubToken != "" && h.repoOwner != "" && h.repoName != "" {
		issueNumber, issueURL, err := h.createGitHubIssue(request, user)
		if err != nil {
			log.Printf("Failed to create GitHub issue: %v", err)
			// Continue anyway - issue creation is best-effort
		} else {
			request.GitHubIssueNumber = &issueNumber
			request.GitHubIssueURL = issueURL
			request.Status = models.RequestStatusOpen
			h.store.UpdateFeatureRequest(request)
		}
	}

	// Create notification for the user
	notification := &models.Notification{
		UserID:           userID,
		FeatureRequestID: &request.ID,
		NotificationType: models.NotificationTypeIssueCreated,
		Title:            "Request Submitted",
		Message:          fmt.Sprintf("Your %s request '%s' has been submitted.", request.RequestType, request.Title),
	}
	h.store.CreateNotification(notification)

	return c.Status(fiber.StatusCreated).JSON(request)
}

// ListFeatureRequests returns the user's feature requests
func (h *FeedbackHandler) ListFeatureRequests(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	requests, err := h.store.GetUserFeatureRequests(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to list feature requests")
	}

	if requests == nil {
		requests = []models.FeatureRequest{}
	}

	return c.JSON(requests)
}

// GetFeatureRequest returns a single feature request
func (h *FeedbackHandler) GetFeatureRequest(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
	}

	request, err := h.store.GetFeatureRequest(id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get feature request")
	}
	if request == nil {
		return fiber.NewError(fiber.StatusNotFound, "Feature request not found")
	}

	// Ensure user owns this request
	if request.UserID != userID {
		return fiber.NewError(fiber.StatusForbidden, "Access denied")
	}

	return c.JSON(request)
}

// SubmitFeedback submits thumbs up/down feedback on a PR
func (h *FeedbackHandler) SubmitFeedback(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	requestID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request ID")
	}

	var input models.SubmitFeedbackInput
	if err := c.BodyParser(&input); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Validate feedback type
	if input.FeedbackType != models.FeedbackTypePositive && input.FeedbackType != models.FeedbackTypeNegative {
		return fiber.NewError(fiber.StatusBadRequest, "Feedback type must be 'positive' or 'negative'")
	}

	// Get the feature request
	request, err := h.store.GetFeatureRequest(requestID)
	if err != nil || request == nil {
		return fiber.NewError(fiber.StatusNotFound, "Feature request not found")
	}

	// Ensure user owns this request
	if request.UserID != userID {
		return fiber.NewError(fiber.StatusForbidden, "Access denied")
	}

	// Ensure there's a PR to provide feedback on
	if request.PRNumber == nil {
		return fiber.NewError(fiber.StatusBadRequest, "No PR available for feedback")
	}

	// Create feedback
	feedback := &models.PRFeedback{
		FeatureRequestID: requestID,
		UserID:           userID,
		FeedbackType:     input.FeedbackType,
		Comment:          input.Comment,
	}

	if err := h.store.CreatePRFeedback(feedback); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to submit feedback")
	}

	// Add comment to GitHub PR if configured
	if h.githubToken != "" && request.PRNumber != nil {
		go h.addPRComment(request, feedback)
	}

	return c.Status(fiber.StatusCreated).JSON(feedback)
}

// GetNotifications returns the user's notifications
func (h *FeedbackHandler) GetNotifications(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	limit := c.QueryInt("limit", 50)
	if limit > 100 {
		limit = 100
	}

	notifications, err := h.store.GetUserNotifications(userID, limit)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get notifications")
	}

	if notifications == nil {
		notifications = []models.Notification{}
	}

	return c.JSON(notifications)
}

// GetUnreadCount returns the count of unread notifications
func (h *FeedbackHandler) GetUnreadCount(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	count, err := h.store.GetUnreadNotificationCount(userID)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get unread count")
	}

	return c.JSON(fiber.Map{"count": count})
}

// MarkNotificationRead marks a notification as read
func (h *FeedbackHandler) MarkNotificationRead(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	notificationID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid notification ID")
	}

	// Get notification to verify ownership
	notifications, err := h.store.GetUserNotifications(userID, 100)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to verify notification")
	}

	found := false
	for _, n := range notifications {
		if n.ID == notificationID {
			found = true
			break
		}
	}
	if !found {
		return fiber.NewError(fiber.StatusNotFound, "Notification not found")
	}

	if err := h.store.MarkNotificationRead(notificationID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to mark notification read")
	}

	return c.JSON(fiber.Map{"success": true})
}

// MarkAllNotificationsRead marks all notifications as read
func (h *FeedbackHandler) MarkAllNotificationsRead(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	if err := h.store.MarkAllNotificationsRead(userID); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to mark all notifications read")
	}

	return c.JSON(fiber.Map{"success": true})
}

// HandleGitHubWebhook handles incoming GitHub webhook events
func (h *FeedbackHandler) HandleGitHubWebhook(c *fiber.Ctx) error {
	// Verify webhook signature if secret is configured
	if h.webhookSecret != "" {
		signature := c.Get("X-Hub-Signature-256")
		if !h.verifyWebhookSignature(c.Body(), signature) {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid webhook signature")
		}
	}

	eventType := c.Get("X-GitHub-Event")
	var payload map[string]interface{}
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid JSON payload")
	}

	switch eventType {
	case "issues":
		return h.handleIssueEvent(payload)
	case "pull_request":
		return h.handlePREvent(payload)
	case "deployment_status":
		return h.handleDeploymentStatus(payload)
	default:
		// Ignore other events
		return c.JSON(fiber.Map{"status": "ignored", "event": eventType})
	}
}

// handleIssueEvent processes issue events
func (h *FeedbackHandler) handleIssueEvent(payload map[string]interface{}) error {
	action, _ := payload["action"].(string)
	issue, _ := payload["issue"].(map[string]interface{})
	if issue == nil {
		return nil
	}

	issueNumber := int(issue["number"].(float64))

	// Find feature request by issue number
	// This is a simplified lookup - in production you'd want a proper index
	// For now, we'll skip this as we don't have a method to lookup by issue number
	log.Printf("[Webhook] Issue #%d %s", issueNumber, action)

	return nil
}

// handlePREvent processes pull request events
func (h *FeedbackHandler) handlePREvent(payload map[string]interface{}) error {
	action, _ := payload["action"].(string)
	pr, _ := payload["pull_request"].(map[string]interface{})
	if pr == nil {
		return nil
	}

	prNumber := int(pr["number"].(float64))
	prURL, _ := pr["html_url"].(string)

	// Check if this is an AI-generated PR by looking at labels
	labels, _ := pr["labels"].([]interface{})
	isAIGenerated := false
	for _, l := range labels {
		label, _ := l.(map[string]interface{})
		if name, _ := label["name"].(string); name == "ai-generated" {
			isAIGenerated = true
			break
		}
	}

	if !isAIGenerated {
		return nil
	}

	// Extract feature request ID from PR body (we embed it when creating the PR)
	body, _ := pr["body"].(string)
	requestID := extractFeatureRequestID(body)
	if requestID == uuid.Nil {
		log.Printf("[Webhook] PR #%d has no feature request ID", prNumber)
		return nil
	}

	request, err := h.store.GetFeatureRequest(requestID)
	if err != nil || request == nil {
		log.Printf("[Webhook] Feature request %s not found", requestID)
		return nil
	}

	switch action {
	case "opened":
		// Update request with PR info
		h.store.UpdateFeatureRequestPR(requestID, prNumber, prURL)
		h.createNotification(request.UserID, &requestID, models.NotificationTypePRCreated,
			"PR Created", fmt.Sprintf("A fix for '%s' is ready for review.", request.Title))

	case "closed":
		merged, _ := pr["merged"].(bool)
		if merged {
			h.store.UpdateFeatureRequestStatus(requestID, models.RequestStatusClosed)
			h.createNotification(request.UserID, &requestID, models.NotificationTypePRMerged,
				"Fix Merged", fmt.Sprintf("The fix for '%s' has been merged!", request.Title))
		} else {
			h.createNotification(request.UserID, &requestID, models.NotificationTypePRClosed,
				"PR Closed", fmt.Sprintf("The PR for '%s' was closed without merging.", request.Title))
		}
	}

	log.Printf("[Webhook] PR #%d %s for request %s", prNumber, action, requestID)
	return nil
}

// handleDeploymentStatus processes deployment status events (for Netlify previews)
func (h *FeedbackHandler) handleDeploymentStatus(payload map[string]interface{}) error {
	deploymentStatus, _ := payload["deployment_status"].(map[string]interface{})
	if deploymentStatus == nil {
		return nil
	}

	state, _ := deploymentStatus["state"].(string)
	if state != "success" {
		return nil
	}

	targetURL, _ := deploymentStatus["target_url"].(string)
	if targetURL == "" {
		return nil
	}

	deployment, _ := payload["deployment"].(map[string]interface{})
	if deployment == nil {
		return nil
	}

	// Extract PR number from deployment ref
	ref, _ := deployment["ref"].(string)
	prNumber := extractPRNumber(ref)
	if prNumber == 0 {
		return nil
	}

	log.Printf("[Webhook] Deployment success for PR #%d: %s", prNumber, targetURL)

	// Find feature request by PR number and update preview URL
	// This requires a new store method - for now, log and skip
	return nil
}

// createGitHubIssue creates an issue on GitHub
func (h *FeedbackHandler) createGitHubIssue(request *models.FeatureRequest, user *models.User) (int, string, error) {
	// Determine labels based on request type
	labels := []string{"ai-fix-requested", "needs-triage"}
	if request.RequestType == models.RequestTypeBug {
		labels = append(labels, "bug")
	} else {
		labels = append(labels, "enhancement")
	}

	issueBody := fmt.Sprintf(`## User Request

**Type:** %s
**Submitted by:** @%s
**Console Request ID:** %s

## Description

%s

---
*This issue was automatically created from the KubeStellar Console.*
`, request.RequestType, user.GitHubLogin, request.ID.String(), request.Description)

	payload := map[string]interface{}{
		"title":  request.Title,
		"body":   issueBody,
		"labels": labels,
	}

	jsonData, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues", h.repoOwner, h.repoName)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, "", err
	}

	req.Header.Set("Authorization", "Bearer "+h.githubToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return 0, "", fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, "", err
	}

	return result.Number, result.HTMLURL, nil
}

// addPRComment adds a comment to a GitHub PR
func (h *FeedbackHandler) addPRComment(request *models.FeatureRequest, feedback *models.PRFeedback) {
	if request.PRNumber == nil {
		return
	}

	emoji := ""
	if feedback.FeedbackType == models.FeedbackTypePositive {
		emoji = ":+1:"
	} else {
		emoji = ":-1:"
	}

	commentBody := fmt.Sprintf("**User Feedback:** %s\n\n", emoji)
	if feedback.Comment != "" {
		commentBody += fmt.Sprintf("> %s", feedback.Comment)
	}

	payload := map[string]string{"body": commentBody}
	jsonData, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues/%d/comments",
		h.repoOwner, h.repoName, *request.PRNumber)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Failed to create PR comment request: %v", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+h.githubToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to add PR comment: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("GitHub API returned %d when adding PR comment: %s", resp.StatusCode, string(body))
	}
}

// verifyWebhookSignature verifies GitHub webhook signature
func (h *FeedbackHandler) verifyWebhookSignature(payload []byte, signature string) bool {
	if signature == "" || len(signature) < 7 {
		return false
	}

	mac := hmac.New(sha256.New, []byte(h.webhookSecret))
	mac.Write(payload)
	expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// createNotification is a helper to create notifications
func (h *FeedbackHandler) createNotification(userID uuid.UUID, requestID *uuid.UUID, notifType models.NotificationType, title, message string) {
	notification := &models.Notification{
		UserID:           userID,
		FeatureRequestID: requestID,
		NotificationType: notifType,
		Title:            title,
		Message:          message,
	}
	if err := h.store.CreateNotification(notification); err != nil {
		log.Printf("Failed to create notification: %v", err)
	}
}

// extractFeatureRequestID extracts the feature request ID from a PR body
func extractFeatureRequestID(body string) uuid.UUID {
	// Look for pattern: Console Request ID: <uuid>
	prefix := "Console Request ID:** "
	idx := bytes.Index([]byte(body), []byte(prefix))
	if idx == -1 {
		return uuid.Nil
	}

	start := idx + len(prefix)
	if start+36 > len(body) {
		return uuid.Nil
	}

	id, err := uuid.Parse(body[start : start+36])
	if err != nil {
		return uuid.Nil
	}
	return id
}

// extractPRNumber extracts PR number from a deployment ref
func extractPRNumber(ref string) int {
	// Netlify deployments use refs like "pull/123/head"
	var prNumber int
	fmt.Sscanf(ref, "pull/%d/head", &prNumber)
	return prNumber
}

// LoadFeedbackConfigFromEnv loads feedback configuration from environment
func LoadFeedbackConfigFromEnv() FeedbackConfig {
	return FeedbackConfig{
		GitHubToken:   os.Getenv("FEEDBACK_GITHUB_TOKEN"),
		WebhookSecret: os.Getenv("GITHUB_WEBHOOK_SECRET"),
		RepoOwner:     getEnvOrDefault("FEEDBACK_REPO_OWNER", "kubestellar"),
		RepoName:      getEnvOrDefault("FEEDBACK_REPO_NAME", "console"),
	}
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
