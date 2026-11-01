package repositories

import (
	"backend/internal/models"

	"gorm.io/gorm"
)

type UserRepository struct{ db *gorm.DB }

func NewUserRepository(db *gorm.DB) *UserRepository { return &UserRepository{db} }

func (r *UserRepository) Create(u *models.User) error { return translate(r.db.Create(u).Error) }

func (r *UserRepository) Get(id string) (*models.User, error) {
	var u models.User
	return &u, translate(r.db.First(&u, "id = ?", id).Error)
}

// FindByLogin looks a user up by e-mail or phone.
func (r *UserRepository) FindByLogin(email, phone string) (*models.User, error) {
	var u models.User
	return &u, translate(r.db.First(&u, "email = ? OR phone = ?", email, phone).Error)
}

func (r *UserRepository) Update(id string, fields map[string]any) error {
	return translate(r.db.Model(&models.User{}).Where("id = ?", id).Updates(fields).Error)
}
