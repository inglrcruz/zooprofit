package controllers

import (
	"net/http"

	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ProductController struct{ products *services.ProductService }

func NewProductController(products *services.ProductService) *ProductController {
	return &ProductController{products}
}

// Move records an entry or exit of stock for the product in the path.
func (h *ProductController) Move(c *gin.Context) {
	var move models.ProductMove
	if !bind(c, &move) {
		return
	}
	if err := h.products.Move(Actor(c), c.Param("id"), &move); err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, move)
}
