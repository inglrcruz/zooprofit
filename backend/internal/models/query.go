package models

// Query narrows a farm-scoped read. Column names come from the code that
// builds it, never from the request.
type Query struct {
	Eq            map[string]any
	In            map[string][]string
	DateCol       string
	From, To      string
	Limit, Offset int
}
