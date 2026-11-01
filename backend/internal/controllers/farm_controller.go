package controllers

import (
	"net/http"

	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

type FarmController struct{ farms *services.FarmService }

func NewFarmController(farms *services.FarmService) *FarmController { return &FarmController{farms} }

func (h *FarmController) List(c *gin.Context) {
	farms, err := h.farms.List(userID(c))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, farms)
}

func (h *FarmController) Create(c *gin.Context) {
	var in services.FarmInput
	if !bind(c, &in) {
		return
	}
	farm, err := h.farms.Create(userID(c), in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, farm)
}

func (h *FarmController) Get(c *gin.Context) {
	farm, err := h.farms.Get(Actor(c))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"farm": farm, "rol": Actor(c).Role, "allowedLotIds": Actor(c).AllowedLots})
}

func (h *FarmController) Update(c *gin.Context) {
	var in services.FarmUpdate
	if !bind(c, &in) {
		return
	}
	farm, err := h.farms.Update(Actor(c), in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, farm)
}

func (h *FarmController) Delete(c *gin.Context) {
	if err := h.farms.Delete(Actor(c)); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *FarmController) Members(c *gin.Context) {
	members, err := h.farms.Members(Actor(c))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, members)
}

func (h *FarmController) UpdateMember(c *gin.Context) {
	var in services.MemberUpdate
	if !bind(c, &in) {
		return
	}
	member, err := h.farms.UpdateMember(Actor(c), c.Param("userId"), in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, member)
}

func (h *FarmController) RemoveMember(c *gin.Context) {
	if err := h.farms.RemoveMember(Actor(c), c.Param("userId")); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *FarmController) Invite(c *gin.Context) {
	var in services.InviteInput
	if !bind(c, &in) {
		return
	}
	inv, err := h.farms.Invite(Actor(c), in)
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusCreated, inv)
}

func (h *FarmController) Invitations(c *gin.Context) {
	invs, err := h.farms.Invitations(Actor(c))
	if err != nil {
		Fail(c, err)
		return
	}
	c.JSON(http.StatusOK, invs)
}

func (h *FarmController) RevokeInvitation(c *gin.Context) {
	if err := h.farms.RevokeInvitation(Actor(c), c.Param("id")); err != nil {
		Fail(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
