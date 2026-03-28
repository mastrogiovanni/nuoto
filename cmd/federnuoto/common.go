package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type APIResponse struct {
	Content string `json:"content"`
	Status  string `json:"status"`
}

var httpClient = &http.Client{}

func QueryFedernuoto(apiURL string, formData url.Values) (*APIResponse, error) {

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/x-www-form-urlencoded; charset=UTF-8")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apiResp APIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, err
	}
	return &apiResp, nil

}
