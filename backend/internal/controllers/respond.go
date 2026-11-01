package controllers

import (
	"errors"
	"log"
	"net/http"

	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

var statusOf = map[models.Kind]int{
	models.KindInvalid:      http.StatusBadRequest,
	models.KindUnauthorized: http.StatusUnauthorized,
	models.KindForbidden:    http.StatusForbidden,
	models.KindNotFound:     http.StatusNotFound,
	models.KindConflict:     http.StatusConflict,
}

// Fail answers with the status a domain error stands for. Anything else is
// a bug or an outage: it is logged and hidden from the client.
func Fail(c *gin.Context, err error) {
	var e *models.Error
	if errors.As(err, &e) {
		c.AbortWithStatusJSON(statusOf[e.Kind], gin.H{"error": e.Msg})
		return
	}
	log.Printf("%s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "error interno"})
}

// bind decodes and validates the JSON body, answering 400 when it is wrong.
func bind(c *gin.Context, into any) bool {
	if err := c.ShouldBindJSON(into); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "datos inválidos", "detail": err.Error()})
		return false
	}
	return true
}

// The auth middlewares leave who is calling in the context.

func SetUserID(c *gin.Context, id string)       { c.Set("userID", id) }
func SetActor(c *gin.Context, a services.Actor) { c.Set("actor", a) }

func userID(c *gin.Context) string { return c.GetString("userID") }

func Actor(c *gin.Context) services.Actor {
	a, _ := c.Get("actor")
	return a.(services.Actor)
}
