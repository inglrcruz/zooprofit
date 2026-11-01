package middleware

import (
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"backend/internal/controllers"
	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Auth requires a valid "Authorization: Bearer <token>" header.
func Auth(auth *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok {
			controllers.Fail(c, models.Unauthorized("falta el token de sesión"))
			return
		}
		userID, err := auth.UserID(token)
		if err != nil {
			controllers.Fail(c, err)
			return
		}
		controllers.SetUserID(c, userID)
	}
}

// FarmAccess guards /farms/:farmId: the caller must own the farm or be a
// member of it. Membership is read on every request, so removing someone
// takes effect at once.
func FarmAccess(farms *services.FarmService) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor, err := farms.Actor(c.GetString("userID"), c.Param("farmId"))
		if err != nil {
			controllers.Fail(c, err)
			return
		}
		controllers.SetActor(c, actor)
	}
}

// LotAccess guards /lots/:lotId/…: the lot must belong to the farm and be
// one the caller may reach.
func LotAccess(lots *services.LotService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := lots.Get(controllers.Actor(c), c.Param("lotId")); err != nil {
			controllers.Fail(c, err)
		}
	}
}

// RateLimit allows each client IP max requests per window.
//
// ponytail: fixed window kept in memory — right for one instance. Move the
// counters to Redis when the API runs on more than one.
func RateLimit(max int, window time.Duration) gin.HandlerFunc {
	var mu sync.Mutex
	hits := map[string]int{}
	reset := time.Now().Add(window)
	return func(c *gin.Context) {
		mu.Lock()
		if now := time.Now(); now.After(reset) {
			hits, reset = map[string]int{}, now.Add(window)
		}
		hits[c.ClientIP()]++
		n := hits[c.ClientIP()]
		mu.Unlock()
		if n > max {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "demasiados intentos, espera un momento"})
		}
	}
}

// CORS lets the listed origins ("*" for any) call the API from a browser.
// Sessions travel in a header, not a cookie, so "*" exposes nothing.
func CORS(origins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if slices.Contains(origins, "*") {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if slices.Contains(origins, origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
		}
	}
}

// BodyLimit rejects request bodies larger than n bytes.
func BodyLimit(n int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, n)
	}
}
