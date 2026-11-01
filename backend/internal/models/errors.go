package models

// Kind classifies a domain error; the HTTP layer maps it to a status code.
type Kind int

const (
	KindInvalid Kind = iota
	KindUnauthorized
	KindForbidden
	KindNotFound
	KindConflict
)

type Error struct {
	Kind Kind
	Msg  string
}

func (e *Error) Error() string { return e.Msg }

func Invalid(msg string) error      { return &Error{KindInvalid, msg} }
func Unauthorized(msg string) error { return &Error{KindUnauthorized, msg} }
func Forbidden(msg string) error    { return &Error{KindForbidden, msg} }
func NotFound(msg string) error     { return &Error{KindNotFound, msg} }
func Conflict(msg string) error     { return &Error{KindConflict, msg} }
