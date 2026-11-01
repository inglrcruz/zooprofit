package services

import (
	"errors"
	"strings"
	"time"

	"backend/internal/models"
	"backend/internal/repositories"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	users  *repositories.UserRepository
	farms  *repositories.FarmRepository
	secret []byte
	ttl    time.Duration
	// dummyHash is compared against when the user does not exist, so a login
	// attempt takes the same time either way.
	dummyHash []byte
}

func NewAuthService(users *repositories.UserRepository, farms *repositories.FarmRepository, secret string, ttl time.Duration) *AuthService {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("farmprofit"), bcrypt.DefaultCost)
	return &AuthService{users, farms, []byte(secret), ttl, dummy}
}

type Session struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// The password is a 4-digit PIN. It only holds up because sign-in is rate
// limited per IP (routes.go); do not loosen that limit.
type RegisterInput struct {
	Name     string `json:"name" binding:"required,max=120"`
	Email    string `json:"email" binding:"omitempty,email,max=191"`
	Phone    string `json:"phone" binding:"max=20"`
	Password string `json:"password" binding:"required,len=4,numeric"`
}

func (s *AuthService) Register(in RegisterInput) (*Session, error) {
	u := &models.User{ID: uuid.NewString(), Name: strings.TrimSpace(in.Name)}
	if email := strings.ToLower(strings.TrimSpace(in.Email)); email != "" {
		u.Email = &email
	}
	if in.Phone != "" {
		phone, err := normalizePhone(in.Phone)
		if err != nil {
			return nil, err
		}
		u.Phone = &phone
	}
	if u.Email == nil && u.Phone == nil {
		return nil, models.Invalid("indica un correo o un teléfono")
	}
	if err := setPassword(u, in.Password); err != nil {
		return nil, err
	}
	if err := s.users.Create(u); err != nil {
		return nil, accountTaken(err)
	}
	return s.session(u)
}

type LoginInput struct {
	// Identifier is an e-mail or a phone number.
	Identifier string `json:"identifier" binding:"required,max=191"`
	Password   string `json:"password" binding:"required,max=72"`
}

func (s *AuthService) Login(in LoginInput) (*Session, error) {
	var email, phone string
	if strings.Contains(in.Identifier, "@") {
		email = strings.ToLower(strings.TrimSpace(in.Identifier))
	} else {
		phone = digits(in.Identifier)
	}
	u, err := s.users.FindByLogin(email, phone)
	hash := s.dummyHash
	if err == nil {
		hash = []byte(u.PasswordHash)
	} else if !isKind(err, models.KindNotFound) {
		return nil, err
	}
	if bcrypt.CompareHashAndPassword(hash, []byte(in.Password)) != nil || err != nil {
		return nil, models.Unauthorized("usuario o contraseña incorrectos")
	}
	return s.session(u)
}

// InvitationPreview is what a code reveals before it is redeemed.
type InvitationPreview struct {
	FarmName string      `json:"farmName"`
	Nombre   string      `json:"nombre"`
	Rol      models.Role `json:"rol"`
}

func (s *AuthService) Invitation(code string) (*InvitationPreview, error) {
	inv, err := s.validInvitation(code)
	if err != nil {
		return nil, err
	}
	farm, err := s.farms.Get(inv.FarmID)
	if err != nil {
		return nil, err
	}
	return &InvitationPreview{farm.Name, inv.Nombre, inv.Rol}, nil
}

type JoinInput struct {
	Code     string `json:"code" binding:"required,len=6,numeric"`
	Password string `json:"password" binding:"required,len=4,numeric"`
	Phone    string `json:"phone" binding:"max=20"`
}

// Join creates the account of an invited worker, already inside the farm.
// The worker signs in with their phone or, lacking one, with the e-mail
// derived from the code.
func (s *AuthService) Join(in JoinInput) (*Session, error) {
	inv, err := s.validInvitation(in.Code)
	if err != nil {
		return nil, err
	}
	u := &models.User{ID: uuid.NewString(), Name: inv.Nombre}
	if raw := firstOf(in.Phone, inv.Telefono); raw != "" {
		phone, err := normalizePhone(raw)
		if err != nil {
			return nil, err
		}
		u.Phone = &phone
	} else {
		email := "emp" + inv.Code + "@farmprofit.app"
		u.Email = &email
	}
	if err := setPassword(u, in.Password); err != nil {
		return nil, err
	}
	if err := s.farms.Redeem(inv, u.ID, u); err != nil {
		return nil, accountTaken(err)
	}
	return s.session(u)
}

// Accept attaches an existing account to the farm of an invitation.
func (s *AuthService) Accept(userID, code string) error {
	inv, err := s.validInvitation(code)
	if err != nil {
		return err
	}
	farm, err := s.farms.Get(inv.FarmID)
	if err != nil {
		return err
	}
	if farm.OwnerID == userID {
		return models.Conflict("ya perteneces a esta granja")
	}
	err = s.farms.Redeem(inv, userID, nil)
	if isKind(err, models.KindConflict) {
		return models.Conflict("ya perteneces a esta granja")
	}
	return err
}

func (s *AuthService) validInvitation(code string) (*models.Invitation, error) {
	inv, err := s.farms.InvitationByCode(strings.TrimSpace(code))
	if isKind(err, models.KindNotFound) {
		return nil, models.Invalid("código incorrecto")
	}
	if err != nil {
		return nil, err
	}
	if inv.Usado {
		return nil, models.Invalid("este código ya fue utilizado")
	}
	if time.Now().After(inv.ExpiresAt) {
		return nil, models.Invalid("el código ha expirado, solicita uno nuevo al administrador")
	}
	return inv, nil
}

func (s *AuthService) Me(userID string) (*models.User, error) { return s.users.Get(userID) }

type ProfileInput struct {
	Name      *string `json:"name" binding:"omitempty,min=1,max=120"`
	PushToken *string `json:"pushToken" binding:"omitempty,max=255"`
}

func (s *AuthService) UpdateMe(userID string, in ProfileInput) (*models.User, error) {
	fields := map[string]any{}
	if in.Name != nil {
		fields["name"] = strings.TrimSpace(*in.Name)
	}
	if in.PushToken != nil {
		fields["push_token"] = *in.PushToken
	}
	if len(fields) > 0 {
		if err := s.users.Update(userID, fields); err != nil {
			return nil, err
		}
	}
	return s.users.Get(userID)
}

type PasswordInput struct {
	Current  string `json:"current" binding:"required,max=72"`
	Password string `json:"password" binding:"required,len=4,numeric"`
}

// ChangePassword replaces the user's PIN after checking the current one, so
// a borrowed phone with an open session is not enough to take the account.
func (s *AuthService) ChangePassword(userID string, in PasswordInput) error {
	u, err := s.users.Get(userID)
	if err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Current)) != nil {
		return models.Invalid("la clave actual no es correcta")
	}
	if err := setPassword(u, in.Password); err != nil {
		return err
	}
	return s.users.Update(userID, map[string]any{"password_hash": u.PasswordHash})
}

func (s *AuthService) session(u *models.User) (*Session, error) {
	now := time.Now()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   u.ID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
	}).SignedString(s.secret)
	return &Session{token, u}, err
}

// UserID returns the user a token was issued to.
func (s *AuthService) UserID(token string) (string, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil || claims.Subject == "" {
		return "", models.Unauthorized("sesión inválida o expirada")
	}
	return claims.Subject, nil
}

func setPassword(u *models.User, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	u.PasswordHash = string(hash)
	return err
}

func digits(s string) string {
	return strings.Map(func(r rune) rune {
		if r < '0' || r > '9' {
			return -1
		}
		return r
	}, s)
}

func normalizePhone(s string) (string, error) {
	d := digits(s)
	if len(d) < 7 || len(d) > 15 {
		return "", models.Invalid("teléfono inválido")
	}
	return d, nil
}

func accountTaken(err error) error {
	if isKind(err, models.KindConflict) {
		return models.Conflict("ya existe una cuenta con ese correo o teléfono")
	}
	return err
}

func isKind(err error, kind models.Kind) bool {
	var e *models.Error
	return errors.As(err, &e) && e.Kind == kind
}

// firstOf returns the first non-empty string.
func firstOf(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
