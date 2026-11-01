package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DSN            string
	JWTSecret      string
	JWTExpiration  time.Duration
	CORSOrigins    []string
	TrustedProxies []string
}

func Load() *Config {
	// A missing .env is fine: in production the variables come from the environment.
	_ = godotenv.Load()

	secret := require("JWT_SECRET")
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET debe tener al menos 32 caracteres")
	}
	hours, err := strconv.Atoi(env("JWT_EXPIRATION_HOURS", "720"))
	if err != nil || hours <= 0 {
		log.Fatal("JWT_EXPIRATION_HOURS inválido")
	}

	return &Config{
		Port: env("BACKEND_PORT", "8080"),
		DSN: fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=UTC",
			require("MYSQL_USER"), require("MYSQL_PASSWORD"),
			env("MYSQL_HOST", "127.0.0.1"), env("MYSQL_PORT", "3306"), require("MYSQL_DATABASE")),
		JWTSecret:      secret,
		JWTExpiration:  time.Duration(hours) * time.Hour,
		CORSOrigins:    list(env("CORS_ORIGINS", "*")),
		TrustedProxies: list(os.Getenv("TRUSTED_PROXIES")),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func require(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("falta la variable de entorno %s", key)
	}
	return v
}

func list(v string) []string {
	var out []string
	for _, s := range strings.Split(v, ",") {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}
