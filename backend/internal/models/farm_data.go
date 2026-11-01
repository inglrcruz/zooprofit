package models

import "time"

// Base is embedded by everything that lives inside a farm.
type Base struct {
	// ID may be sent by the client (it generates ids while offline, which makes
	// retried creates idempotent); the service assigns one otherwise.
	ID        string    `gorm:"type:varchar(36);primaryKey" json:"id" binding:"max=36"`
	FarmID    string    `gorm:"type:varchar(36);not null;index" json:"farmId"`
	Farm      *Farm     `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (b *Base) Meta() *Base { return b }

// Entity is any farm-scoped model.
type Entity interface{ Meta() *Base }

// LotScoped is an Entity that belongs to one lot for its whole life.
type LotScoped interface {
	LotRef() *string
}

// ponytail: calendar dates are char(10) "YYYY-MM-DD" — they sort and compare
// correctly and never drift across timezones. Switch to DATE with a custom
// scanner if SQL date arithmetic is ever needed on them.

type Lot struct {
	Base
	Code string `gorm:"size:60;not null" json:"code" binding:"required,max=60"`
	// CodeInterno marks the lots the system creates and relies on ("__destetadas__").
	CodeInterno    string  `gorm:"size:40" json:"codeInterno" binding:"max=40"`
	EsFijo         bool    `gorm:"not null" json:"esFijo"`
	Nave           string  `gorm:"size:60" json:"nave" binding:"max=60"`
	Fase           string  `gorm:"size:30" json:"fase" binding:"max=30"`
	SubLabel       string  `gorm:"size:20" json:"subLabel" binding:"max=20"`
	Archivado      bool    `gorm:"not null" json:"archivado"`
	SortOrder      int     `json:"sortOrder"`
	ParentLotID    string  `gorm:"type:varchar(36)" json:"parentLotId" binding:"max=36"`
	OrigenLotID    string  `gorm:"type:varchar(36)" json:"origenLotId" binding:"max=36"`
	EntryDate      string  `gorm:"type:char(10)" json:"entryDate" binding:"omitempty,datetime=2006-01-02"`
	BirthDate      string  `gorm:"type:char(10)" json:"birthDate" binding:"omitempty,datetime=2006-01-02"`
	FechaInicio    string  `gorm:"type:char(10)" json:"fechaInicio" binding:"omitempty,datetime=2006-01-02"`
	FechaFin       string  `gorm:"type:char(10)" json:"fechaFin" binding:"omitempty,datetime=2006-01-02"`
	FechaCierre    string  `gorm:"type:char(10)" json:"fechaCierre" binding:"omitempty,datetime=2006-01-02"`
	InitialAnimals int     `json:"initialAnimals" binding:"min=0"`
	ActiveAnimals  int     `json:"activeAnimals" binding:"min=0"`
	EntryWeight    float64 `json:"entryWeight" binding:"min=0"`
	// Data keeps what the app stores on a lot beyond the columns above (sowAretes…).
	Data map[string]any `gorm:"type:json;serializer:json" json:"data"`
}

// Registro is one recorded event of a lot: postura, alimento, muerte,
// inseminacion, parto, destete, pesada, venta, nota…
type Registro struct {
	Base
	LotID  string `gorm:"type:varchar(36);not null;index:idx_registros_lot_fecha,priority:1" json:"lotId"`
	Lot    *Lot   `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Tipo   string `gorm:"size:40;not null;index" json:"tipo" binding:"required,max=40"`
	Fecha  string `gorm:"type:char(10);not null;index:idx_registros_lot_fecha,priority:2" json:"fecha" binding:"required,datetime=2006-01-02"`
	Status string `gorm:"size:10;not null;default:pending" json:"status" binding:"omitempty,oneof=pending confirmed"`
	// SowID / CerdaCodigo link the event to a sow when it is about one.
	SowID       string `gorm:"type:varchar(36);index" json:"sowId" binding:"max=36"`
	CerdaCodigo string `gorm:"size:40" json:"cerdaCodigo" binding:"max=40"`
	Nota        string `gorm:"type:text" json:"nota" binding:"max=2000"`
	// Data is the payload that depends on Tipo (pilas, cartones, verraco,
	// lechonesVivos, pesoTotal…). The app owns its shape.
	Data        map[string]any `gorm:"type:json;serializer:json" json:"data"`
	CreadoPor   string         `gorm:"type:varchar(36);index" json:"creadoPor"`
	ConfirmedBy string         `gorm:"type:varchar(36)" json:"confirmedBy"`
	ConfirmedAt *time.Time     `json:"confirmedAt"`
}

func (r *Registro) LotRef() *string { return &r.LotID }

// Protocol is a medication / vaccination plan running on a lot.
type Protocol struct {
	Base
	LotID        string `gorm:"type:varchar(36);not null;index" json:"lotId"`
	Lot          *Lot   `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Nombre       string `gorm:"size:120;not null" json:"nombre" binding:"required,max=120"`
	Medicamento  string `gorm:"size:120" json:"medicamento" binding:"max=120"`
	Categoria    string `gorm:"size:30" json:"categoria" binding:"max=30"`
	Via          string `gorm:"size:30" json:"via" binding:"max=30"`
	Dosis        string `gorm:"size:60" json:"dosis" binding:"max=60"`
	FechaInicio  string `gorm:"type:char(10);not null" json:"fechaInicio" binding:"required,datetime=2006-01-02"`
	DuracionDias int    `json:"duracionDias" binding:"min=0"`
	RetiroDias   int    `json:"retiroDias" binding:"min=0"`
	Activo       bool   `gorm:"not null;default:true" json:"activo"`
}

func (p *Protocol) LotRef() *string { return &p.LotID }

type Sow struct {
	Base
	// Arete is not unique: real farms reuse tags after a sow leaves.
	Arete             string         `gorm:"size:40;not null;index" json:"arete" binding:"required,max=40"`
	Tipo              string         `gorm:"size:20" json:"tipo" binding:"max=20"`
	Genetica          string         `gorm:"size:40" json:"genetica" binding:"max=40"`
	EstadoActual      string         `gorm:"size:20;index" json:"estadoActual" binding:"max=20"`
	LotIDActual       string         `gorm:"type:varchar(36);index" json:"lotIdActual" binding:"max=36"`
	LotOrigenID       string         `gorm:"type:varchar(36)" json:"lotOrigenId" binding:"max=36"`
	FechaEntrada      string         `gorm:"type:char(10)" json:"fechaEntrada" binding:"omitempty,datetime=2006-01-02"`
	FechaNacimiento   string         `gorm:"type:char(10)" json:"fechaNacimiento" binding:"omitempty,datetime=2006-01-02"`
	FechaUltimoParto  string         `gorm:"type:char(10)" json:"fechaUltimoParto" binding:"omitempty,datetime=2006-01-02"`
	PartosHistoricos  int            `json:"partosHistoricos" binding:"min=0"`
	NumRepeticiones   int            `json:"numRepeticiones" binding:"min=0"`
	MotivoSalida      string         `gorm:"size:60" json:"motivoSalida" binding:"max=60"`
	CodigosAnteriores []string       `gorm:"type:json;serializer:json" json:"codigosAnteriores"`
	Data              map[string]any `gorm:"type:json;serializer:json" json:"data"`
}

type Boar struct {
	Base
	Codigo       string `gorm:"size:40;not null" json:"codigo" binding:"required,max=40"`
	Nombre       string `gorm:"size:60" json:"nombre" binding:"max=60"`
	Genetica     string `gorm:"size:40" json:"genetica" binding:"max=40"`
	FechaEntrada string `gorm:"type:char(10)" json:"fechaEntrada" binding:"omitempty,datetime=2006-01-02"`
	Activo       bool   `gorm:"not null;default:true" json:"activo"`
}

type Nave struct {
	Base
	Nombre string `gorm:"size:60;not null" json:"nombre" binding:"required,max=60"`
	Tipo   string `gorm:"size:30" json:"tipo" binding:"max=30"`
	Orden  int    `json:"orden"`
	// Layout is the grid the app draws the corrales on.
	Layout any `gorm:"type:json;serializer:json" json:"layout"`
}

type Corral struct {
	Base
	NaveID          string         `gorm:"type:varchar(36);not null;index" json:"naveId" binding:"required,max=36"`
	Nave            *Nave          `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	Numero          string         `gorm:"size:20;not null" json:"numero" binding:"required,max=20"`
	Largo           float64        `json:"largo" binding:"min=0"`
	Ancho           float64        `json:"ancho" binding:"min=0"`
	Capacidad       int            `json:"capacidad" binding:"min=0"`
	AnimalesActivos int            `json:"animalesActivos" binding:"min=0"`
	LotID           string         `gorm:"type:varchar(36);index" json:"lotId" binding:"max=36"`
	Data            map[string]any `gorm:"type:json;serializer:json" json:"data"`
}

// Product is anything kept in stock: feed, medicine, vaccines, raw materials
// of the mill, eggs by size.
type Product struct {
	Base
	Codigo      string  `gorm:"size:40;index" json:"codigo" binding:"max=40"`
	Descripcion string  `gorm:"size:160;not null" json:"descripcion" binding:"required,max=160"`
	Tipo        string  `gorm:"size:30" json:"tipo" binding:"max=30"`
	Unidad      string  `gorm:"size:20" json:"unidad" binding:"max=20"`
	Minimo      float64 `gorm:"type:decimal(14,2);not null;default:0" json:"minimo" binding:"min=0"`
	Costo       float64 `gorm:"type:decimal(14,2);not null;default:0" json:"costo" binding:"min=0"`
	// Existencia only changes through movimientos, never by editing the product.
	Existencia float64 `gorm:"type:decimal(14,2);not null;default:0" json:"existencia"`
}

type ProductMove struct {
	Base
	ProductID string   `gorm:"type:varchar(36);not null;index" json:"productId"`
	Product   *Product `gorm:"constraint:OnDelete:CASCADE" json:"-"`
	// Cantidad is signed: positive enters stock, negative leaves it.
	Cantidad  float64 `gorm:"type:decimal(14,2);not null" json:"cantidad" binding:"required"`
	Tipo      string  `gorm:"size:20;not null" json:"tipo" binding:"required,max=20"`
	Fecha     string  `gorm:"type:char(10);not null;index" json:"fecha" binding:"required,datetime=2006-01-02"`
	LotID     string  `gorm:"type:varchar(36);index" json:"lotId" binding:"max=36"`
	Nota      string  `gorm:"size:255" json:"nota" binding:"max=255"`
	CreadoPor string  `gorm:"type:varchar(36)" json:"creadoPor"`
}

// Conteo is a physical stock count of the mill.
type Conteo struct {
	Base
	Fecha  string `gorm:"type:char(10);not null" json:"fecha" binding:"required,datetime=2006-01-02"`
	Status string `gorm:"size:10;not null;default:abierto" json:"status" binding:"omitempty,oneof=abierto cerrado"`
	// Items maps product code → what was counted ({bultos, librasSueltas}).
	Items map[string]any `gorm:"type:json;serializer:json" json:"items"`
}

type Aportante struct {
	Base
	// UserID links the row to the account that may see it from the portal.
	UserID  string  `gorm:"type:varchar(36);index" json:"userId" binding:"max=36"`
	Nombre  string  `gorm:"size:120;not null" json:"nombre" binding:"required,max=120"`
	Capital float64 `gorm:"type:decimal(14,2);not null;default:0" json:"capital" binding:"min=0"`
}

type Prestamo struct {
	Base
	UserID  string  `gorm:"type:varchar(36);index" json:"userId" binding:"max=36"`
	Nombre  string  `gorm:"size:120;not null" json:"nombre" binding:"required,max=120"`
	Monto   float64 `gorm:"type:decimal(14,2);not null" json:"monto" binding:"required,gt=0"`
	Tasa    float64 `gorm:"type:decimal(5,2);not null;default:0" json:"tasa" binding:"min=0,max=100"`
	Cuotas  int     `gorm:"not null" json:"cuotas" binding:"required,min=1"`
	Pagadas int     `gorm:"not null;default:0" json:"pagadas" binding:"min=0,ltefield=Cuotas"`
	Fecha   string  `gorm:"type:char(10)" json:"fecha" binding:"omitempty,datetime=2006-01-02"`
}

// CoopMove is one line of the cooperative's ledger: aporte, retiro,
// ganancia, cuota.
type CoopMove struct {
	Base
	UserID      string  `gorm:"type:varchar(36);index" json:"userId" binding:"max=36"`
	AportanteID string  `gorm:"type:varchar(36);index" json:"aportanteId" binding:"max=36"`
	PrestamoID  string  `gorm:"type:varchar(36);index" json:"prestamoId" binding:"max=36"`
	Tipo        string  `gorm:"size:20;not null" json:"tipo" binding:"required,max=20"`
	Monto       float64 `gorm:"type:decimal(14,2);not null" json:"monto" binding:"required"`
	Fecha       string  `gorm:"type:char(10);not null;index" json:"fecha" binding:"required,datetime=2006-01-02"`
	Nota        string  `gorm:"size:255" json:"nota" binding:"max=255"`
}
