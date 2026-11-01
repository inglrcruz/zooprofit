package controllers

import (
	"net/http"

	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AuthController struct{ auth *services.AuthService }

func NewAuthController(auth *services.AuthService) *AuthController { return &AuthController{auth} }

func (h *AuthController) Register(c *gin.Context) {
	var in services.RegisterInput
	if !bind(c, &in) {
		return
	}
	session, err := h.auth.Register(in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

func (h *AuthController) Login(c *gin.Context) {
	var in services.LoginInput
	if !bind(c, &in) {
		return
	}
	session, err := h.auth.Login(in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, session)
}

// Invitation tells what a code is for before the worker sets a password.
func (h *AuthController) Invitation(c *gin.Context) {
	preview, err := h.auth.Invitation(c.Param("code"))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, preview)
}

func (h *AuthController) Join(c *gin.Context) {
	var in services.JoinInput
	if !bind(c, &in) {
		return
	}
	session, err := h.auth.Join(in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, session)
}

// Accept redeems a code with the account that is already signed in.
func (h *AuthController) Accept(c *gin.Context) {
	if err := h.auth.Accept(userID(c), c.Param("code")); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthController) Me(c *gin.Context) {
	user, err := h.auth.Me(userID(c))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *AuthController) ChangePassword(c *gin.Context) {
	var in services.PasswordInput
	if !bind(c, &in) {
		return
	}
	if err := h.auth.ChangePassword(userID(c), in); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthController) UpdateMe(c *gin.Context) {
	var in services.ProfileInput
	if !bind(c, &in) {
		return
	}
	user, err := h.auth.UpdateMe(userID(c), in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, user)
}
