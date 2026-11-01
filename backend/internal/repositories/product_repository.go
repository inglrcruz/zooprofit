package repositories

import (
	"backend/internal/models"

	"gorm.io/gorm"
)

type ProductRepository struct{ db *gorm.DB }

func NewProductRepository(db *gorm.DB) *ProductRepository { return &ProductRepository{db} }

// Move records the movement and adjusts the stock atomically, so two phones
// consuming the same product never overwrite each other.
func (r *ProductRepository) Move(m *models.ProductMove) error {
	return translate(r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.Product{}).
			Where("farm_id = ? AND id = ?", m.FarmID, m.ProductID).
			Update("existencia", gorm.Expr("existencia + ?", m.Cantidad))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return models.NotFound("producto no encontrado")
		}
		return tx.Create(m).Error
	}))
}
