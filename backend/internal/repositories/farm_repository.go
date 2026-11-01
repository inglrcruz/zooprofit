package repositories

import (
	"time"

	"backend/internal/models"

	"gorm.io/gorm"
)

type FarmRepository struct{ db *gorm.DB }

func NewFarmRepository(db *gorm.DB) *FarmRepository { return &FarmRepository{db} }

// FarmOfUser is a farm together with the role the user holds in it.
type FarmOfUser struct {
	models.Farm
	Rol models.Role `json:"rol"`
}

// ListForUser returns the farms the user owns or is a member of.
func (r *FarmRepository) ListForUser(userID string) ([]FarmOfUser, error) {
	farms := []FarmOfUser{}
	err := r.db.Model(&models.Farm{}).
		Select("farms.*, IF(farms.owner_id = ?, ?, m.rol) AS rol", userID, models.RoleAdmin).
		Joins("LEFT JOIN farm_members m ON m.farm_id = farms.id AND m.user_id = ?", userID).
		Where("farms.owner_id = ? OR m.user_id IS NOT NULL", userID).
		Order("farms.created_at").
		Find(&farms).Error
	return farms, err
}

func (r *FarmRepository) Get(id string) (*models.Farm, error) {
	var f models.Farm
	return &f, translate(r.db.First(&f, "id = ?", id).Error)
}

// Create stores the farm and the lots it starts with, or nothing.
func (r *FarmRepository) Create(f *models.Farm, lots []models.Lot) error {
	return translate(r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(f).Error; err != nil {
			return err
		}
		if len(lots) == 0 {
			return nil
		}
		return tx.Create(&lots).Error
	}))
}

func (r *FarmRepository) Save(f *models.Farm) error { return translate(r.db.Save(f).Error) }

func (r *FarmRepository) Delete(id string) error {
	return translate(r.db.Delete(&models.Farm{}, "id = ?", id).Error)
}

/* ───── members ───── */

// Member is a membership with the user's public data.
type Member struct {
	models.FarmMember
	Name  string  `json:"name"`
	Email *string `json:"email"`
	Phone *string `json:"phone"`
}

func (r *FarmRepository) Members(farmID string) ([]Member, error) {
	members := []Member{}
	err := r.db.Model(&models.FarmMember{}).
		Select("farm_members.*, u.name, u.email, u.phone").
		Joins("JOIN users u ON u.id = farm_members.user_id").
		Where("farm_members.farm_id = ?", farmID).
		Order("farm_members.added_at").
		Find(&members).Error
	return members, err
}

func (r *FarmRepository) Member(farmID, userID string) (*models.FarmMember, error) {
	var m models.FarmMember
	return &m, translate(r.db.First(&m, "farm_id = ? AND user_id = ?", farmID, userID).Error)
}

func (r *FarmRepository) SaveMember(m *models.FarmMember) error {
	return translate(r.db.Save(m).Error)
}

func (r *FarmRepository) RemoveMember(farmID, userID string) error {
	res := r.db.Delete(&models.FarmMember{}, "farm_id = ? AND user_id = ?", farmID, userID)
	if res.Error == nil && res.RowsAffected == 0 {
		return models.NotFound("miembro no encontrado")
	}
	return translate(res.Error)
}

/* ───── invitations ───── */

func (r *FarmRepository) CreateInvitation(inv *models.Invitation) error {
	return translate(r.db.Create(inv).Error)
}

func (r *FarmRepository) Invitations(farmID string) ([]models.Invitation, error) {
	invs := []models.Invitation{}
	return invs, r.db.Where("farm_id = ?", farmID).Order("created_at DESC").Find(&invs).Error
}

func (r *FarmRepository) InvitationByCode(code string) (*models.Invitation, error) {
	var inv models.Invitation
	return &inv, translate(r.db.First(&inv, "code = ?", code).Error)
}

func (r *FarmRepository) DeleteInvitation(farmID, id string) error {
	res := r.db.Delete(&models.Invitation{}, "farm_id = ? AND id = ?", farmID, id)
	if res.Error == nil && res.RowsAffected == 0 {
		return models.NotFound("invitación no encontrada")
	}
	return translate(res.Error)
}

// Redeem spends the invitation and adds its membership in one transaction,
// creating the account first when newUser is given. The conditional UPDATE is
// what stops two devices from redeeming the same code at once.
func (r *FarmRepository) Redeem(inv *models.Invitation, userID string, newUser *models.User) error {
	return translate(r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		res := tx.Model(&models.Invitation{}).
			Where("id = ? AND usado = ? AND expires_at > ?", inv.ID, false, now).
			Updates(map[string]any{"usado": true, "usuario_id": userID, "usado_at": now})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return models.Invalid("este código ya fue utilizado o expiró")
		}
		if newUser != nil {
			if err := tx.Create(newUser).Error; err != nil {
				return err
			}
		}
		return tx.Create(&models.FarmMember{
			FarmID: inv.FarmID, UserID: userID, Rol: inv.Rol, AllowedLotIDs: inv.LotIDs,
		}).Error
	}))
}
