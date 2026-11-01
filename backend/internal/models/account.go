package models

import "time"

type User struct {
	ID           string    `gorm:"type:varchar(36);primaryKey" json:"id"`
	Name         string    `gorm:"size:120;not null" json:"name"`
	Email        *string   `gorm:"size:191;uniqueIndex" json:"email"`
	Phone        *string   `gorm:"size:20;uniqueIndex" json:"phone"`
	PasswordHash string    `gorm:"size:100;not null" json:"-"`
	PushToken    string    `gorm:"size:255" json:"pushToken"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// Farm is one "módulo" of the app: a pig farm, a hen house, the feed mill or
// the cooperative.
type Farm struct {
	ID      string `gorm:"type:varchar(36);primaryKey" json:"id"`
	Name    string `gorm:"size:120;not null" json:"name"`
	Species string `gorm:"size:20;not null" json:"species"`
	Type    string `gorm:"size:20;not null" json:"type"`
	OwnerID string `gorm:"type:varchar(36);not null;index" json:"ownerId"`
	Owner   *User  `gorm:"constraint:OnDelete:RESTRICT" json:"-"`
	// Config holds the free-form settings the app keeps per farm: kpiConfig,
	// weekConfig, reglas, umbrales, catálogos de semen/técnicos.
	Config    map[string]any `gorm:"type:json;serializer:json" json:"config"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// FarmTypes lists the valid type values for each species.
var FarmTypes = map[string][]string{
	"cerdos":     {"reproduccion", "produccion"},
	"aves":       {"ponedora", "engorde"},
	"fabrica":    {"fabrica"},
	"coopprofit": {"coopprofit"},
}

type Role string

// RoleAdmin is the farm owner; it is never stored in farm_members.
const RoleAdmin Role = "admin"

// MemberRoles are the roles an invitation or membership may carry.
var MemberRoles = []Role{"veterinario", "supervisor", "asesor", "auxiliar", "propietario", "aportante", "prestatario"}

func (r Role) Valid() bool {
	for _, m := range MemberRoles {
		if r == m {
			return true
		}
	}
	return false
}

// CanMembers: manage the farm itself, its members and invitations.
func (r Role) CanMembers() bool { return r == RoleAdmin }

// CanAudit: confirm and correct what others recorded.
func (r Role) CanAudit() bool { return r == RoleAdmin || r == "veterinario" || r == "supervisor" }

// CanWrite: record data at all. The remaining roles only look.
func (r Role) CanWrite() bool { return r != "propietario" && !r.SelfOnly() }

// SelfOnly: cooperative members, who only see the rows that are theirs.
func (r Role) SelfOnly() bool { return r == "aportante" || r == "prestatario" }

type FarmMember struct {
	FarmID string `gorm:"type:varchar(36);primaryKey" json:"farmId"`
	Farm   *Farm  `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	UserID string `gorm:"type:varchar(36);primaryKey;index" json:"userId"`
	User   *User  `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Rol    Role   `gorm:"size:20;not null" json:"rol"`
	// AllowedLotIDs empty means access to every lot.
	AllowedLotIDs []string  `gorm:"type:json;serializer:json" json:"allowedLotIds"`
	AddedAt       time.Time `gorm:"autoCreateTime" json:"addedAt"`
}

// Invitation is the 6-digit code an owner hands to a worker so they can
// create their account already attached to the farm.
type Invitation struct {
	ID        string     `gorm:"type:varchar(36);primaryKey" json:"id"`
	FarmID    string     `gorm:"type:varchar(36);not null;index" json:"farmId"`
	Farm      *Farm      `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Code      string     `gorm:"type:char(6);not null;uniqueIndex" json:"code"`
	Nombre    string     `gorm:"size:120;not null" json:"nombre"`
	Rol       Role       `gorm:"size:20;not null" json:"rol"`
	LotIDs    []string   `gorm:"type:json;serializer:json" json:"lotIds"`
	Telefono  string     `gorm:"size:20" json:"telefono"`
	ExpiresAt time.Time  `json:"expiresAt"`
	Usado     bool       `gorm:"not null" json:"usado"`
	UsuarioID *string    `gorm:"type:varchar(36)" json:"usuarioId"`
	UsadoAt   *time.Time `json:"usadoAt"`
	CreatedAt time.Time  `json:"createdAt"`
}
