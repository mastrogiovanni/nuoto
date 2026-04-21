package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// ─── Domain types ─────────────────────────────────────────────────────────────

// User is the authenticated identity stored in session JWTs.
type User struct {
	Sub      string `json:"sub"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Picture  string `json:"picture,omitempty"`
	Provider string `json:"provider"`
}

type sessionClaims struct {
	User `json:"user"`
	jwt.RegisteredClaims
}

type contextKey int

const ctxUser contextKey = 1

// ─── Helpers ──────────────────────────────────────────────────────────────────

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		panic("JWT_SECRET env var is not set")
	}
	return []byte(s)
}

func appBaseURL() string {
	u := os.Getenv("BASE_URL")
	if u == "" {
		u = "http://localhost:5173"
	}
	return strings.TrimRight(u, "/")
}

func generateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func setStateCookie(w http.ResponseWriter, state string) {
	secure := strings.HasPrefix(appBaseURL(), "https")
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func checkState(r *http.Request) bool {
	c, err := r.Cookie("oauth_state")
	if err != nil {
		return false
	}
	return c.Value != "" && c.Value == r.FormValue("state")
}

func createSessionJWT(user User) (string, error) {
	claims := sessionClaims{
		User: user,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(jwtSecret())
}

func redirectToFrontend(w http.ResponseWriter, r *http.Request, token string) {
	dest := appBaseURL() + "/auth/callback?token=" + url.QueryEscape(token)
	http.Redirect(w, r, dest, http.StatusFound)
}

// htmlRedirect returns an HTML page that meta-refreshes to dest.
// Used for POST-initiated flows (Apple callback) where a normal 302 redirect
// would preserve the POST method in some browsers.
func htmlRedirect(w http.ResponseWriter, dest string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html><html><head>`+
		`<meta http-equiv="refresh" content="0;url=%s">`+
		`</head><body>Redirecting…</body></html>`, dest)
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

// authMiddleware validates the Bearer JWT and injects the User into context.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &sessionClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected alg %v", t.Header["alg"])
			}
			return jwtSecret(), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxUser, claims.User)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func userFromCtx(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(ctxUser).(User)
	return u, ok
}

// ─── /api/auth/me ─────────────────────────────────────────────────────────────

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromCtx(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

func (s *Server) googleConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  appBaseURL() + "/api/auth/google/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
}

func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	state := generateState()
	setStateCookie(w, state)
	http.Redirect(w, r, s.googleConfig().AuthCodeURL(state), http.StatusFound)
}

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	if !checkState(r) {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}
	token, err := s.googleConfig().Exchange(r.Context(), r.FormValue("code"))
	if err != nil {
		log.Printf("Google OAuth exchange: %v", err)
		http.Error(w, "exchange failed", http.StatusInternalServerError)
		return
	}
	client := s.googleConfig().Client(r.Context(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		log.Printf("Google userinfo fetch: %v", err)
		http.Error(w, "userinfo failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	var info struct {
		Sub     string `json:"sub"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		http.Error(w, "decode failed", http.StatusInternalServerError)
		return
	}
	user := User{Sub: info.Sub, Email: info.Email, Name: info.Name, Picture: info.Picture, Provider: "google"}
	sessionToken, err := createSessionJWT(user)
	if err != nil {
		http.Error(w, "jwt failed", http.StatusInternalServerError)
		return
	}
	redirectToFrontend(w, r, sessionToken)
}

// ─── Apple Sign In ────────────────────────────────────────────────────────────

// appleClientSecret generates the ES256-signed JWT Apple requires as client_secret.
// Apple credentials come from environment variables (see AUTH.md).
func appleClientSecret() (string, error) {
	keyData := os.Getenv("APPLE_PRIVATE_KEY")
	if keyData == "" {
		path := os.Getenv("APPLE_PRIVATE_KEY_PATH")
		if path == "" {
			return "", fmt.Errorf("neither APPLE_PRIVATE_KEY nor APPLE_PRIVATE_KEY_PATH is set")
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("read apple key file: %w", err)
		}
		keyData = string(b)
	}
	// Allow escaped newlines in env var values.
	keyData = strings.ReplaceAll(keyData, `\n`, "\n")

	block, _ := pem.Decode([]byte(keyData))
	if block == nil {
		return "", fmt.Errorf("failed to PEM-decode Apple private key")
	}
	privKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("parse Apple private key: %w", err)
	}
	ecKey, ok := privKey.(*ecdsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("Apple private key is not an EC key")
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss": os.Getenv("APPLE_TEAM_ID"),
		"iat": now.Unix(),
		"exp": now.Add(180 * 24 * time.Hour).Unix(), // 6-month Apple maximum
		"aud": "https://appleid.apple.com",
		"sub": os.Getenv("APPLE_SERVICE_ID"),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	t.Header["kid"] = os.Getenv("APPLE_KEY_ID")
	return t.SignedString(ecKey)
}

func (s *Server) handleAppleLogin(w http.ResponseWriter, r *http.Request) {
	state := generateState()
	setStateCookie(w, state)

	params := url.Values{}
	params.Set("client_id", os.Getenv("APPLE_SERVICE_ID"))
	params.Set("redirect_uri", appBaseURL()+"/api/auth/apple/callback")
	params.Set("response_type", "code id_token")
	params.Set("response_mode", "form_post") // required when requesting id_token
	params.Set("scope", "name email")
	params.Set("state", state)

	http.Redirect(w, r, "https://appleid.apple.com/auth/authorize?"+params.Encode(), http.StatusFound)
}

// ─── Apple JWKS verification ──────────────────────────────────────────────────

type appleJWKS struct {
	Keys []struct {
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func fetchApplePublicKey(kid string) (*rsa.PublicKey, error) {
	resp, err := http.Get("https://appleid.apple.com/auth/keys")
	if err != nil {
		return nil, fmt.Errorf("fetch Apple JWKS: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var jwks appleJWKS
	if err := json.Unmarshal(body, &jwks); err != nil {
		return nil, err
	}
	for _, k := range jwks.Keys {
		if k.Kid != kid {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			return nil, err
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			return nil, err
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		return &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}, nil
	}
	return nil, fmt.Errorf("kid %q not found in Apple JWKS", kid)
}

func verifyAppleIDToken(tokenStr string) (sub, email string, err error) {
	// Decode header without verification to get the key ID.
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return "", "", fmt.Errorf("malformed JWT")
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", fmt.Errorf("decode header: %w", err)
	}
	var header struct {
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return "", "", fmt.Errorf("parse header: %w", err)
	}

	pubKey, err := fetchApplePublicKey(header.Kid)
	if err != nil {
		return "", "", err
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected alg %v", t.Header["alg"])
		}
		return pubKey, nil
	})
	if err != nil || !token.Valid {
		return "", "", fmt.Errorf("invalid Apple ID token: %w", err)
	}

	if iss, _ := claims["iss"].(string); iss != "https://appleid.apple.com" {
		return "", "", fmt.Errorf("invalid issuer: %s", iss)
	}
	if aud, _ := claims["aud"].(string); aud != os.Getenv("APPLE_SERVICE_ID") {
		return "", "", fmt.Errorf("invalid audience: %s", aud)
	}

	sub, _ = claims["sub"].(string)
	email, _ = claims["email"].(string)
	return sub, email, nil
}

// handleAppleCallback processes Apple's form_post response.
// Apple POSTs to this endpoint (not a GET redirect), so we return an HTML
// meta-refresh page to deliver the session token to the frontend.
func (s *Server) handleAppleCallback(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	idToken := r.FormValue("id_token")
	if idToken == "" {
		http.Error(w, "missing id_token", http.StatusBadRequest)
		return
	}

	sub, email, err := verifyAppleIDToken(idToken)
	if err != nil {
		log.Printf("Apple ID token verification: %v", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	name := email // Apple only sends name on the very first authorisation.
	if userJSON := r.FormValue("user"); userJSON != "" {
		var appleUser struct {
			Name struct {
				FirstName string `json:"firstName"`
				LastName  string `json:"lastName"`
			} `json:"name"`
		}
		if json.Unmarshal([]byte(userJSON), &appleUser) == nil {
			n := strings.TrimSpace(appleUser.Name.FirstName + " " + appleUser.Name.LastName)
			if n != "" {
				name = n
			}
		}
	}

	user := User{Sub: sub, Email: email, Name: name, Provider: "apple"}
	sessionToken, err := createSessionJWT(user)
	if err != nil {
		http.Error(w, "jwt failed", http.StatusInternalServerError)
		return
	}

	dest := appBaseURL() + "/auth/callback?token=" + url.QueryEscape(sessionToken)
	htmlRedirect(w, dest)
}
