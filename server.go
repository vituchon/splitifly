package main

import (
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

func main() {
	StartServer()
}

func StartServer() {

	router := buildRouter()
	port := getenv("PORT", "9999")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  40 * time.Second,
		WriteTimeout: 300 * time.Second,
	}
	log.Printf("Splitifly web server listening at port %v", server.Addr)
	err := server.ListenAndServe()
	if err != nil {
		log.Println("Unexpected error initiliazing Splitifly web server: ", err)
	}
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if len(value) == 0 {
		return fallback
	}
	return value
}

func buildRouter() *mux.Router {
	router := mux.NewRouter()
	router.NotFoundHandler = http.HandlerFunc(NoMatchingHandler)

	fileServer := http.FileServer(http.Dir("./assets"))
	//router.PathPrefix("/assets/").Handler(http.StripPrefix("/assets/", fileServer))
	router.PathPrefix("/assets/").Handler(http.StripPrefix("/assets/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Println("Serving static file:", r.URL.Path)
		fileServer.ServeHTTP(w, r)
	})))

	// Rutas públicas con CORS
	router.HandleFunc("/healthcheck", addCORS(Healthcheck)).Methods("GET", "OPTIONS")
	router.HandleFunc("/version", addCORS(Version)).Methods("GET", "OPTIONS")

	// Ruta raíz para el index.html
	router.HandleFunc("/", serveRoot).Methods("GET")

	return router
}

// Helper function para añadir headers CORS
func addCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func NoMatchingHandler(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/favicon.ico" { // don't log this
		log.Println("No maching route for " + request.URL.Path)
	}
	response.WriteHeader(http.StatusNotFound)
}

func serveRoot(response http.ResponseWriter, request *http.Request) {
	t, err := template.ParseFiles("./assets/html/index.html")
	if err != nil {
		log.Printf("Error while parsing template : %v", err)
		response.WriteHeader(http.StatusInternalServerError)
		return
	}
	t.Execute(response, nil)
}

func Healthcheck(response http.ResponseWriter, request *http.Request) {
	response.WriteHeader(http.StatusOK)
}

const ServerVersion = "0.0.1"

func Version(response http.ResponseWriter, request *http.Request) {
	response.WriteHeader(http.StatusOK)
	response.Write([]byte(ServerVersion))
}
