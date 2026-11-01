package routes

import (
	"net/http"
	"time"

	"backend/internal/controllers"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Deps is everything the routes hand requests to.
type Deps struct {
	Auth      *services.AuthService
	Farms     *services.FarmService
	Lots      *services.LotService
	Registros *services.RegistroService
	Products  *services.ProductService

	Protocols  services.CRUD[models.Protocol]
	Sows       services.CRUD[models.Sow]
	Boars      services.CRUD[models.Boar]
	Naves      services.CRUD[models.Nave]
	Corrales   services.CRUD[models.Corral]
	Moves      services.CRUD[models.ProductMove]
	Conteos    services.CRUD[models.Conteo]
	Aportantes services.CRUD[models.Aportante]
	Prestamos  services.CRUD[models.Prestamo]
	CoopMoves  services.CRUD[models.CoopMove]
}

func Register(r *gin.Engine, d Deps) {
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	authCtl := controllers.NewAuthController(d.Auth)
	farmCtl := controllers.NewFarmController(d.Farms)
	productCtl := controllers.NewProductController(d.Products)

	// Public, and therefore throttled: passwords and 6-digit codes are
	// guessable without a limit.
	public := r.Group("/auth", middleware.RateLimit(20, time.Minute))
	public.POST("/register", authCtl.Register)
	public.POST("/login", authCtl.Login)
	public.GET("/invitations/:code", authCtl.Invitation)
	public.POST("/join", authCtl.Join)

	private := r.Group("", middleware.Auth(d.Auth))
	private.GET("/me", authCtl.Me)
	private.PATCH("/me", authCtl.UpdateMe)
	// Throttled like sign-in: the current PIN is guessable too.
	private.PATCH("/me/password", middleware.RateLimit(20, time.Minute), authCtl.ChangePassword)
	private.POST("/invitations/:code/accept", middleware.RateLimit(20, time.Minute), authCtl.Accept)
	private.GET("/farms", farmCtl.List)
	private.POST("/farms", farmCtl.Create)

	farm := private.Group("/farms/:farmId", middleware.FarmAccess(d.Farms))
	farm.GET("", farmCtl.Get)
	farm.PATCH("", farmCtl.Update)
	farm.DELETE("", farmCtl.Delete)
	farm.GET("/members", farmCtl.Members)
	farm.PATCH("/members/:userId", farmCtl.UpdateMember)
	farm.DELETE("/members/:userId", farmCtl.RemoveMember)
	farm.GET("/invitations", farmCtl.Invitations)
	farm.POST("/invitations", farmCtl.Invite)
	farm.DELETE("/invitations/:id", farmCtl.RevokeInvitation)

	lots := controllers.NewResource[models.Lot](d.Lots, "", map[string]string{"archivado": "archivado", "fase": "fase", "parentLotId": "parent_lot_id"})
	lots.IDParam = "lotId"
	farm.GET("/lots", lots.List)
	farm.POST("/lots", lots.Create)
	farm.GET("/lots/:lotId", lots.Get)
	farm.PATCH("/lots/:lotId", lots.Update)
	farm.DELETE("/lots/:lotId", lots.Delete)

	// What belongs to a lot is created and listed under it, and reached by
	// id (or listed farm-wide) from the farm.
	registros := controllers.NewResource[models.Registro](d.Registros, "fecha", map[string]string{"lotId": "lot_id", "tipo": "tipo", "status": "status", "sowId": "sow_id", "creadoPor": "creado_por"})
	protocols := controllers.NewResource(d.Protocols, "fecha_inicio", map[string]string{"lotId": "lot_id", "activo": "activo"})
	lot := farm.Group("/lots/:lotId", middleware.LotAccess(d.Lots))
	lot.GET("/registros", registros.List)
	lot.POST("/registros", registros.Create)
	lot.GET("/protocolos", protocols.List)
	lot.POST("/protocolos", protocols.Create)
	byID(farm, "/registros", registros)
	byID(farm, "/protocolos", protocols)

	crud(farm, "/cerdas", controllers.NewResource(d.Sows, "", map[string]string{"estado": "estado_actual", "lotId": "lot_id_actual", "arete": "arete"}))
	crud(farm, "/verracos", controllers.NewResource(d.Boars, "", map[string]string{"activo": "activo"}))
	crud(farm, "/naves", controllers.NewResource(d.Naves, "", nil))
	crud(farm, "/corrales", controllers.NewResource(d.Corrales, "", map[string]string{"naveId": "nave_id", "lotId": "lot_id"}))
	crud(farm, "/productos", controllers.NewResource[models.Product](d.Products, "", map[string]string{"tipo": "tipo", "codigo": "codigo"}))
	crud(farm, "/conteos", controllers.NewResource(d.Conteos, "fecha", map[string]string{"status": "status"}))
	crud(farm, "/aportantes", controllers.NewResource(d.Aportantes, "", nil))
	crud(farm, "/prestamos", controllers.NewResource(d.Prestamos, "fecha", nil))
	crud(farm, "/coop-movimientos", controllers.NewResource(d.CoopMoves, "fecha", map[string]string{"tipo": "tipo", "aportanteId": "aportante_id", "prestamoId": "prestamo_id"}))

	// Stock movements are append-only: they are what moves "existencia".
	farm.POST("/productos/:id/movimientos", productCtl.Move)
	farm.GET("/movimientos", controllers.NewResource(d.Moves, "fecha", map[string]string{"productId": "product_id", "lotId": "lot_id", "tipo": "tipo"}).List)
}

func crud[T any](g *gin.RouterGroup, path string, h *controllers.Resource[T]) {
	g.POST(path, h.Create)
	byID(g, path, h)
}

func byID[T any](g *gin.RouterGroup, path string, h *controllers.Resource[T]) {
	g.GET(path, h.List)
	g.GET(path+"/:id", h.Get)
	g.PATCH(path+"/:id", h.Update)
	g.DELETE(path+"/:id", h.Delete)
}
