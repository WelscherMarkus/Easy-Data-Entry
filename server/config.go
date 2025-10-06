package main

import (
	"log"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

func loadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No Environment file found")
	}

	viper.AutomaticEnv()
	viper.SetDefault("PORT", "1433")
}
