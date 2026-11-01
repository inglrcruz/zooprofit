package services

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"slices"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/repositories"

	"github.com/google/uuid"
)

type FarmService struct {
	farms *repositories.FarmRepository
}

func NewFarmService(farms *repositories.FarmRepository) *FarmService {
	return &FarmService{farms}
}

func (s *FarmService) List(userID string) ([]repositories.FarmOfUser, error) {
	return s.farms.ListForUser(userID)
}

type FarmInput struct {
	Name    string `json:"name" binding:"required,max=120"`
	Species string `json:"species" binding:"required"`
	Type    string `json:"type" binding:"required"`
}

func (s *FarmService) Create(userID string, in FarmInput) (*models.Farm, error) {
	if !slices.Contains(models.FarmTypes[in.Species], in.Type) {
		return nil, models.Invalid("tipo de módulo inválido para esa especie")
	}
	farm := &models.Farm{
		ID: uuid.NewString(), Name: strings.TrimSpace(in.Name),
		Species: in.Species, Type: in.Type, OwnerID: userID, Config: map[string]any{},
	}
	var lots []models.Lot
	if in.Type == "reproduccion" {
		lots = fixedLots(farm.ID, uuid.NewString)
	}
	return farm, s.farms.Create(farm, lots)
}

// Actor resolves what the user is inside the farm. A farm the user does not
// belong to is reported as not found, so its existence is not revealed.
func (s *FarmService) Actor(userID, farmID string) (Actor, error) {
	a := Actor{UserID: userID, FarmID: farmID}
	farm, err := s.farms.Get(farmID)
	if err != nil {
		return a, models.NotFound("granja no encontrada")
	}
	if farm.OwnerID == userID {
		a.Role = models.RoleAdmin
		return a, nil
	}
	m, err := s.farms.Member(farmID, userID)
	if isKind(err, models.KindNotFound) {
		return a, models.NotFound("granja no encontrada")
	}
	if err != nil {
		return a, err
	}
	a.Role, a.AllowedLots = m.Rol, m.AllowedLotIDs
	return a, nil
}

func (s *FarmService) Get(a Actor) (*models.Farm, error) { return s.farms.Get(a.FarmID) }

type FarmUpdate struct {
	Name *string `json:"name" binding:"omitempty,min=1,max=120"`
	// Config replaces the keys it brings and leaves the rest untouched.
	Config map[string]any `json:"config"`
}

func (s *FarmService) Update(a Actor, in FarmUpdate) (*models.Farm, error) {
	if err := ownerOnly(a); err != nil {
		return nil, err
	}
	farm, err := s.farms.Get(a.FarmID)
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		farm.Name = strings.TrimSpace(*in.Name)
	}
	if farm.Config == nil {
		farm.Config = map[string]any{}
	}
	for k, v := range in.Config {
		farm.Config[k] = v
	}
	return farm, s.farms.Save(farm)
}

func (s *FarmService) Delete(a Actor) error {
	if err := ownerOnly(a); err != nil {
		return err
	}
	return s.farms.Delete(a.FarmID)
}

/* ───── members ───── */

func (s *FarmService) Members(a Actor) ([]repositories.Member, error) {
	if err := ownerOnly(a); err != nil {
		return nil, err
	}
	return s.farms.Members(a.FarmID)
}

type MemberUpdate struct {
	Rol           *models.Role `json:"rol"`
	AllowedLotIDs *[]string    `json:"allowedLotIds" binding:"omitempty,dive,max=36"`
}

func (s *FarmService) UpdateMember(a Actor, userID string, in MemberUpdate) (*models.FarmMember, error) {
	if err := ownerOnly(a); err != nil {
		return nil, err
	}
	m, err := s.farms.Member(a.FarmID, userID)
	if err != nil {
		return nil, err
	}
	if in.Rol != nil {
		if !in.Rol.Valid() {
			return nil, models.Invalid("rol inválido")
		}
		m.Rol = *in.Rol
	}
	if in.AllowedLotIDs != nil {
		m.AllowedLotIDs = *in.AllowedLotIDs
	}
	return m, s.farms.SaveMember(m)
}

// RemoveMember lets the owner remove anyone and a member remove itself.
func (s *FarmService) RemoveMember(a Actor, userID string) error {
	if !a.Role.CanMembers() && userID != a.UserID {
		return models.Forbidden("solo el propietario puede quitar miembros")
	}
	return s.farms.RemoveMember(a.FarmID, userID)
}

/* ───── invitations ───── */

const invitationTTL = 48 * time.Hour

type InviteInput struct {
	Nombre   string      `json:"nombre" binding:"required,max=120"`
	Rol      models.Role `json:"rol" binding:"required"`
	LotIDs   []string    `json:"lotIds" binding:"omitempty,dive,max=36"`
	Telefono string      `json:"telefono" binding:"max=20"`
}

func (s *FarmService) Invite(a Actor, in InviteInput) (*models.Invitation, error) {
	if err := ownerOnly(a); err != nil {
		return nil, err
	}
	if !in.Rol.Valid() {
		return nil, models.Invalid("rol inválido")
	}
	inv := &models.Invitation{
		ID: uuid.NewString(), FarmID: a.FarmID, Nombre: strings.TrimSpace(in.Nombre),
		Rol: in.Rol, LotIDs: in.LotIDs, Telefono: digits(in.Telefono),
		ExpiresAt: time.Now().Add(invitationTTL),
	}
	if inv.LotIDs == nil {
		inv.LotIDs = []string{}
	}
	// A code can collide with one handed out before; draw again.
	var err error
	for range 5 {
		n, rerr := rand.Int(rand.Reader, big.NewInt(900000))
		if rerr != nil {
			return nil, rerr
		}
		inv.Code = fmt.Sprint(100000 + n.Int64())
		if err = s.farms.CreateInvitation(inv); !isKind(err, models.KindConflict) {
			break
		}
	}
	return inv, err
}

func (s *FarmService) Invitations(a Actor) ([]models.Invitation, error) {
	if err := ownerOnly(a); err != nil {
		return nil, err
	}
	return s.farms.Invitations(a.FarmID)
}

func (s *FarmService) RevokeInvitation(a Actor, id string) error {
	if err := ownerOnly(a); err != nil {
		return err
	}
	return s.farms.DeleteInvitation(a.FarmID, id)
}

func ownerOnly(a Actor) error {
	if !a.Role.CanMembers() {
		return models.Forbidden("solo el propietario puede hacer esto")
	}
	return nil
}
