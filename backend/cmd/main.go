package main

import (
	"log"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/middleware"
	"backend/internal/models"
	"backend/internal/repositories"
	"backend/internal/routes"
	"backend/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DSN)
	if err != nil {
		log.Fatal("base de datos: ", err)
	}

	// repositories → services → controllers (built in routes.Register)
	farmRepo := repositories.NewFarmRepository(db)
	userRepo := repositories.NewUserRepository(db)

	coopMoves := services.NewResource(repositories.NewResource[models.CoopMove](db, "fecha DESC, created_at DESC"))
	aportantes := services.NewResource(repositories.NewResource[models.Aportante](db, "nombre"))
	prestamos := services.NewResource(repositories.NewResource[models.Prestamo](db, "created_at DESC"))
	coopMoves.UserCol, aportantes.UserCol, prestamos.UserCol = "user_id", "user_id", "user_id"

	protocols := services.NewResource(repositories.NewResource[models.Protocol](db, "fecha_inicio DESC"))
	protocols.LotCol = "lot_id"

	r := gin.Default()
	// With no proxies trusted, the client IP is the socket's and cannot be
	// spoofed through X-Forwarded-For to dodge the rate limit.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Fatal("TRUSTED_PROXIES: ", err)
	}
	r.Use(middleware.CORS(cfg.CORSOrigins), middleware.BodyLimit(1<<20))

	routes.Register(r, routes.Deps{
		Auth:      services.NewAuthService(userRepo, farmRepo, cfg.JWTSecret, cfg.JWTExpiration),
		Farms:     services.NewFarmService(farmRepo),
		Lots:      services.NewLotService(repositories.NewResource[models.Lot](db, "archivado, sort_order, code")),
		Registros: services.NewRegistroService(repositories.NewResource[models.Registro](db, "fecha DESC, created_at DESC")),
		Products:  services.NewProductService(repositories.NewResource[models.Product](db, "descripcion"), repositories.NewProductRepository(db)),

		Protocols:  protocols,
		Sows:       services.NewResource(repositories.NewResource[models.Sow](db, "arete")),
		Boars:      services.NewResource(repositories.NewResource[models.Boar](db, "codigo")),
		Naves:      services.NewResource(repositories.NewResource[models.Nave](db, "orden, nombre")),
		Corrales:   services.NewResource(repositories.NewResource[models.Corral](db, "nave_id, numero")),
		Moves:      services.NewResource(repositories.NewResource[models.ProductMove](db, "fecha DESC, created_at DESC")),
		Conteos:    services.NewResource(repositories.NewResource[models.Conteo](db, "fecha DESC")),
		Aportantes: aportantes,
		Prestamos:  prestamos,
		CoopMoves:  coopMoves,
	})

	log.Fatal(r.Run(":" + cfg.Port))
}
