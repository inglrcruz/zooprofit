package services

import (
	"backend/internal/models"
	"backend/internal/repositories"

	"github.com/google/uuid"
)

type ProductService struct {
	*Resource[models.Product, *models.Product]
	moves *repositories.ProductRepository
}

func NewProductService(repo *repositories.Resource[models.Product], moves *repositories.ProductRepository) *ProductService {
	return &ProductService{NewResource(repo), moves}
}

// Update keeps the stock out of reach: it only changes through Move.
func (s *ProductService) Update(a Actor, id string, apply func(*models.Product) error) (*models.Product, error) {
	return s.Resource.Update(a, id, func(p *models.Product) error {
		stock := p.Existencia
		if err := apply(p); err != nil {
			return err
		}
		p.Existencia = stock
		return nil
	})
}

// Move records an entry (positive) or an exit (negative) of stock.
func (s *ProductService) Move(a Actor, productID string, m *models.ProductMove) error {
	if err := canWrite(a); err != nil {
		return err
	}
	if m.ID == "" {
		m.ID = uuid.NewString()
	}
	m.FarmID, m.ProductID, m.CreadoPor = a.FarmID, productID, a.UserID
	return s.moves.Move(m)
}
