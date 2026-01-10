<?php
header("Access-Control-Allow-Origin: https://schiipha.com.ng");

// Allow cookies / authorization headers if needed later
header("Access-Control-Allow-Credentials: true");

// Allowed HTTP methods
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Allowed headers from frontend
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Response format
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
