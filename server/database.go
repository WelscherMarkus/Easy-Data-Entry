package main

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/microsoft/go-mssqldb/azuread"
	"github.com/spf13/viper"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

func connectToDatabase() (*gorm.DB, error) {

	server := viper.GetString("SERVER")
	database := viper.GetString("DATABASE")
	port := viper.GetInt("PORT")

	if server == "" || database == "" || port == 0 {
		return nil, errors.New("missing required environment variables")
	}

	connString := fmt.Sprintf("server=%s;port=%d;database=%s;fedauth=ActiveDirectoryDefault;", server, port, database)
	db, err := sql.Open(azuread.DriverName, connString)
	if err != nil {
		return nil, err
	}

	config := sqlserver.Config{DriverName: azuread.DriverName, DSN: connString, Conn: db}

	gormDb, err := gorm.Open(sqlserver.New(config), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	return gormDb, nil
}
