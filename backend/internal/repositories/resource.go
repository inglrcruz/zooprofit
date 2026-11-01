package repositories

import (
	"errors"

	"backend/internal/models"

	"gorm.io/gorm"
)

// where adds the conditions of q to a statement.
func where(db *gorm.DB, q models.Query) *gorm.DB {
	for col, v := range q.Eq {
		db = db.Where(col+" = ?", v)
	}
	for col, v := range q.In {
		db = db.Where(col+" IN ?", v)
	}
	if q.DateCol != "" && q.From != "" {
		db = db.Where(q.DateCol+" >= ?", q.From)
	}
	if q.DateCol != "" && q.To != "" {
		db = db.Where(q.DateCol+" <= ?", q.To)
	}
	return db
}

// Resource is the data access for one farm-scoped table. Every statement is
// bound to a farm id, so a row can never be reached through another farm.
type Resource[T any] struct {
	db    *gorm.DB
	order string
}

func NewResource[T any](db *gorm.DB, order string) *Resource[T] {
	return &Resource[T]{db: db, order: order}
}

func (r *Resource[T]) List(farmID string, q models.Query) ([]T, error) {
	items := []T{}
	db := where(r.db.Where("farm_id = ?", farmID), q).Order(r.order)
	if q.Limit > 0 {
		db = db.Limit(q.Limit).Offset(q.Offset)
	}
	return items, db.Find(&items).Error
}

func (r *Resource[T]) Get(farmID, id string, q models.Query) (*T, error) {
	var item T
	err := where(r.db.Where("farm_id = ? AND id = ?", farmID, id), q).First(&item).Error
	return &item, translate(err)
}

func (r *Resource[T]) Create(item *T) error { return translate(r.db.Create(item).Error) }

// Save writes every column of an item previously read with Get.
func (r *Resource[T]) Save(item *T) error { return translate(r.db.Save(item).Error) }

func (r *Resource[T]) Delete(farmID, id string, q models.Query) error {
	var item T
	res := where(r.db.Where("farm_id = ? AND id = ?", farmID, id), q).Delete(&item)
	if res.Error == nil && res.RowsAffected == 0 {
		return models.NotFound("no encontrado")
	}
	return translate(res.Error)
}

// translate maps storage errors to domain errors.
func translate(err error) error {
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		return models.NotFound("no encontrado")
	case errors.Is(err, gorm.ErrDuplicatedKey):
		return models.Conflict("ya existe")
	case errors.Is(err, gorm.ErrForeignKeyViolated):
		return models.Conflict("hace referencia a un registro que no existe o que aún está en uso")
	}
	return err
}
