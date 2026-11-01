package database

import (
	"log"
	"os"
	"time"

	"backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens the pool and brings the schema up to date with the models.
func Connect(dsn string) (*gorm.DB, error) {
	// TranslateError turns driver errors into gorm.ErrDuplicatedKey /
	// gorm.ErrForeignKeyViolated, which the repositories map to domain errors.
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		TranslateError: true,
		// A lookup that finds nothing is a 404, not something to log; and
		// statements are logged without their values, which include password
		// hashes and personal data.
		Logger: logger.New(log.New(os.Stdout, "\r\n", log.LstdFlags), logger.Config{
			SlowThreshold: 200 * time.Millisecond, LogLevel: logger.Warn,
			IgnoreRecordNotFoundError: true, ParameterizedQueries: true,
		}),
	})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(
		&models.User{}, &models.Farm{}, &models.FarmMember{}, &models.Invitation{},
		&models.Lot{}, &models.Registro{}, &models.Protocol{},
		&models.Sow{}, &models.Boar{}, &models.Nave{}, &models.Corral{},
		&models.Product{}, &models.ProductMove{}, &models.Conteo{},
		&models.Aportante{}, &models.Prestamo{}, &models.CoopMove{},
	); err != nil {
		return nil, err
	}
	return db, addEntradasLot(db)
}

// addEntradasLot gives the reproduction farms created before the fixed lot
// "Entradas" existed the lot new sows now go to. It does nothing once they have it.
func addEntradasLot(db *gorm.DB) error {
	return db.Exec(`
		INSERT INTO lots (id, farm_id, code, code_interno, es_fijo, archivado, sort_order, created_at, updated_at)
		SELECT UUID(), f.id, 'Entradas', '__entradas__', TRUE, FALSE, -1, NOW(), NOW()
		FROM farms f
		WHERE f.type = 'reproduccion' AND NOT EXISTS (
			SELECT 1 FROM lots l WHERE l.farm_id = f.id AND l.code_interno = '__entradas__'
		)`).Error
}
