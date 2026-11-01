package services

import (
	"backend/internal/models"
	"backend/internal/repositories"
)

type LotService struct {
	*Resource[models.Lot, *models.Lot]
}

func NewLotService(repo *repositories.Resource[models.Lot]) *LotService {
	r := NewResource(repo)
	r.LotCol = "id"
	return &LotService{r}
}

func (s *LotService) Create(a Actor, lot *models.Lot) error {
	// A restricted member would not be able to see the lot it just created.
	if len(a.AllowedLots) > 0 {
		return models.Forbidden("tu acceso está limitado a lotes específicos")
	}
	// Only the system creates the fixed lots.
	lot.EsFijo, lot.CodeInterno = false, ""
	return s.Resource.Create(a, lot)
}

func (s *LotService) Update(a Actor, id string, apply func(*models.Lot) error) (*models.Lot, error) {
	return s.Resource.Update(a, id, func(lot *models.Lot) error {
		fijo, interno := lot.EsFijo, lot.CodeInterno
		if err := apply(lot); err != nil {
			return err
		}
		lot.EsFijo, lot.CodeInterno = fijo, interno
		return nil
	})
}

func (s *LotService) Delete(a Actor, id string) error {
	lot, err := s.Get(a, id)
	if err != nil {
		return err
	}
	if lot.EsFijo {
		return models.Forbidden("los lotes fijos no se pueden eliminar")
	}
	return s.Resource.Delete(a, id)
}

// fixedLots are the lots every pig reproduction farm starts with.
func fixedLots(farmID string, newID func() string) []models.Lot {
	names := []struct{ code, interno string }{
		{"Entradas", "__entradas__"},
		{"Destetadas", "__destetadas__"},
		{"Atrasadas", "__atrasadas__"},
		{"Descarte", "__descarte__"},
	}
	lots := make([]models.Lot, len(names))
	for i, n := range names {
		lots[i] = models.Lot{
			Base: models.Base{ID: newID(), FarmID: farmID},
			Code: n.code, CodeInterno: n.interno, EsFijo: true, SortOrder: i,
		}
	}
	return lots
}
