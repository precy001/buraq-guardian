<?php

function jsonResponse($success, $message, $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');

    echo json_encode([
        "success" => (bool)$success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}

function sendSuccess($data = null, $message = 'Success', $statusCode = 200) {
    jsonResponse(true, $message, $data, $statusCode);
}

function sendError($message = 'Request failed', $statusCode = 400, $data = null) {
    jsonResponse(false, $message, $data, $statusCode);
}

