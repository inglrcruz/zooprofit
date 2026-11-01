package controllers

import (
	"net/http"
	"strconv"

	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

const (
	defaultLimit = 1000
	maxLimit     = 5000
)

// Resource exposes a farm-scoped resource as REST: list, get, create,
// partial update and delete.
type Resource[T any] struct {
	svc services.CRUD[T]
	// IDParam is the path parameter carrying the item id.
	IDParam string
	// Filters maps the query parameters accepted by List to their column.
	Filters map[string]string
	// DateCol is the column that ?from= and ?to= apply to.
	DateCol string
}

func NewResource[T any](svc services.CRUD[T], dateCol string, filters map[string]string) *Resource[T] {
	return &Resource[T]{svc: svc, IDParam: "id", Filters: filters, DateCol: dateCol}
}

func (h *Resource[T]) List(c *gin.Context) {
	q := models.Query{Eq: map[string]any{}, DateCol: h.DateCol, From: c.Query("from"), To: c.Query("to"), Limit: defaultLimit}
	for param, col := range h.Filters {
		switch v := c.Query(param); v {
		case "":
		case "true", "false":
			q.Eq[col] = v == "true"
		default:
			q.Eq[col] = v
		}
	}
	// Under /lots/:lotId/… the list is that lot's.
	if lot := c.Param("lotId"); lot != "" && h.IDParam != "lotId" {
		q.Eq["lot_id"] = lot
	}
	if n, err := strconv.Atoi(c.Query("limit")); err == nil && n > 0 {
		q.Limit = min(n, maxLimit)
	}
	if n, err := strconv.Atoi(c.Query("offset")); err == nil && n > 0 {
		q.Offset = n
	}
	items, err := h.svc.List(Actor(c), q)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Resource[T]) Get(c *gin.Context) {
	item, err := h.svc.Get(Actor(c), c.Param(h.IDParam))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Resource[T]) Create(c *gin.Context) {
	var item T
	if !bind(c, &item) {
		return
	}
	if ls, ok := any(&item).(models.LotScoped); ok {
		*ls.LotRef() = c.Param("lotId")
	}
	if err := h.svc.Create(Actor(c), &item); err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

// Update is a partial update: the body is decoded over the stored item, so
// absent fields keep their value and JSON objects are merged key by key.
func (h *Resource[T]) Update(c *gin.Context) {
	item, err := h.svc.Update(Actor(c), c.Param(h.IDParam), func(item *T) error {
		if err := c.ShouldBindJSON(item); err != nil {
			return models.Invalid("datos inválidos: " + err.Error())
		}
		return nil
	})
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Resource[T]) Delete(c *gin.Context) {
	if err := h.svc.Delete(Actor(c), c.Param(h.IDParam)); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
