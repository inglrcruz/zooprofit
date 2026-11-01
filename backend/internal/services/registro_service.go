package services

import (
	"time"

	"backend/internal/models"
	"backend/internal/repositories"
)

// RegistroService adds the review workflow on top of the shared rules: a
// worker records events as pending, an auditor confirms or corrects them.
type RegistroService struct {
	*Resource[models.Registro, *models.Registro]
}

func NewRegistroService(repo *repositories.Resource[models.Registro]) *RegistroService {
	r := NewResource(repo)
	r.LotCol = "lot_id"
	return &RegistroService{r}
}

func (s *RegistroService) Create(a Actor, reg *models.Registro) error {
	reg.CreadoPor = a.UserID
	reg.ConfirmedBy, reg.ConfirmedAt = "", nil
	if reg.Status == "confirmed" && a.Role.CanAudit() {
		confirm(a, reg)
	} else {
		reg.Status = "pending"
	}
	return s.Resource.Create(a, reg)
}

func (s *RegistroService) Update(a Actor, id string, apply func(*models.Registro) error) (*models.Registro, error) {
	return s.Resource.Update(a, id, func(reg *models.Registro) error {
		if err := mayChange(a, reg); err != nil {
			return err
		}
		before := *reg
		if err := apply(reg); err != nil {
			return err
		}
		reg.CreadoPor, reg.ConfirmedBy, reg.ConfirmedAt = before.CreadoPor, before.ConfirmedBy, before.ConfirmedAt
		if reg.Status == "" {
			reg.Status = before.Status
		}
		if reg.Status == before.Status {
			return nil
		}
		if !a.Role.CanAudit() {
			return models.Forbidden("tu rol no permite confirmar registros")
		}
		if reg.Status == "confirmed" {
			confirm(a, reg)
		} else {
			reg.ConfirmedBy, reg.ConfirmedAt = "", nil
		}
		return nil
	})
}

func (s *RegistroService) Delete(a Actor, id string) error {
	reg, err := s.Get(a, id)
	if err != nil {
		return err
	}
	if err := mayChange(a, reg); err != nil {
		return err
	}
	return s.Resource.Delete(a, id)
}

// mayChange: auditors change anything; everyone else only what they
// recorded themselves and nobody has confirmed yet.
func mayChange(a Actor, reg *models.Registro) error {
	if a.Role.CanAudit() || (reg.CreadoPor == a.UserID && reg.Status == "pending") {
		return nil
	}
	return models.Forbidden("solo puedes modificar tus registros pendientes")
}

func confirm(a Actor, reg *models.Registro) {
	now := time.Now()
	reg.Status, reg.ConfirmedBy, reg.ConfirmedAt = "confirmed", a.UserID, &now
}
