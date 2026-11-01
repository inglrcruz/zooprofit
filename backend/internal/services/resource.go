package services

import (
	"slices"

	"backend/internal/models"
	"backend/internal/repositories"

	"github.com/google/uuid"
)

// Actor is the authenticated user in the context of one farm.
type Actor struct {
	UserID string
	FarmID string
	Role   models.Role
	// AllowedLots restricts the actor to these lots; empty means all of them.
	AllowedLots []string
}

// CRUD is what the HTTP layer needs from a farm-scoped resource.
type CRUD[T any] interface {
	List(a Actor, q models.Query) ([]T, error)
	Get(a Actor, id string) (*T, error)
	Create(a Actor, item *T) error
	Update(a Actor, id string, apply func(*T) error) (*T, error)
	Delete(a Actor, id string) error
}

// Resource applies the rules shared by everything stored inside a farm:
// who may write, which lots a restricted member reaches, and which rows a
// cooperative member may see.
type Resource[T any, P interface {
	*T
	models.Entity
}] struct {
	repo *repositories.Resource[T]
	// LotCol is the column holding the lot id ("id" for lots themselves).
	LotCol string
	// UserCol is the column holding the user a row belongs to (cooperative).
	UserCol string
}

func NewResource[T any, P interface {
	*T
	models.Entity
}](repo *repositories.Resource[T]) *Resource[T, P] {
	return &Resource[T, P]{repo: repo}
}

// restrict adds the conditions that keep the actor inside what it may see.
func (s *Resource[T, P]) restrict(a Actor, q models.Query) models.Query {
	if s.LotCol != "" && len(a.AllowedLots) > 0 {
		q.In = map[string][]string{s.LotCol: a.AllowedLots}
	}
	if s.UserCol != "" && a.Role.SelfOnly() {
		eq := map[string]any{s.UserCol: a.UserID}
		for k, v := range q.Eq {
			if k != s.UserCol {
				eq[k] = v
			}
		}
		q.Eq = eq
	}
	return q
}

func canWrite(a Actor) error {
	if !a.Role.CanWrite() {
		return models.Forbidden("tu rol no permite modificar datos")
	}
	return nil
}

func (s *Resource[T, P]) List(a Actor, q models.Query) ([]T, error) {
	return s.repo.List(a.FarmID, s.restrict(a, q))
}

func (s *Resource[T, P]) Get(a Actor, id string) (*T, error) {
	return s.repo.Get(a.FarmID, id, s.restrict(a, models.Query{}))
}

func (s *Resource[T, P]) Create(a Actor, item *T) error {
	if err := canWrite(a); err != nil {
		return err
	}
	meta := P(item).Meta()
	if meta.ID == "" {
		meta.ID = uuid.NewString()
	}
	meta.FarmID = a.FarmID
	if ls, ok := any(item).(models.LotScoped); ok && len(a.AllowedLots) > 0 && !slices.Contains(a.AllowedLots, *ls.LotRef()) {
		return models.Forbidden("no tienes acceso a ese lote")
	}
	return s.repo.Create(item)
}

// Update loads the item, lets apply change it and saves it. Identity, farm
// and lot are restored afterwards: no request can move a row elsewhere.
func (s *Resource[T, P]) Update(a Actor, id string, apply func(*T) error) (*T, error) {
	if err := canWrite(a); err != nil {
		return nil, err
	}
	item, err := s.Get(a, id)
	if err != nil {
		return nil, err
	}
	meta := P(item).Meta()
	keep := *meta
	ls, lotScoped := any(item).(models.LotScoped)
	var lot string
	if lotScoped {
		lot = *ls.LotRef()
	}
	if err := apply(item); err != nil {
		return nil, err
	}
	*meta = keep
	if lotScoped {
		*ls.LotRef() = lot
	}
	return item, s.repo.Save(item)
}

func (s *Resource[T, P]) Delete(a Actor, id string) error {
	if err := canWrite(a); err != nil {
		return err
	}
	return s.repo.Delete(a.FarmID, id, s.restrict(a, models.Query{}))
}
