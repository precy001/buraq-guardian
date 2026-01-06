<?php
require "../config/database.php";
require "../utils/response.php";
require "../middleware/cors.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    jsonResponse(false, "Invalid JSON payload");
}

$product_id = $data['product_id'] ?? null;
$password   = $data['password'] ?? null;

if (!$product_id || !$password) {
    jsonResponse(false, "Product ID and password required");
}

/* Fetch user */
$stmt = $pdo->prepare("
    SELECT u.password_hash,
           s.status,
           s.end_date
    FROM users u
    LEFT JOIN subscriptions s ON u.product_id = s.product_id
    WHERE u.product_id = ?
");
$stmt->execute([$product_id]);

$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(false, "Invalid credentials");
}

/* Check subscription */
if (!$user['status'] || $user['status'] !== 'active' || strtotime($user['end_date']) < time()) {
    jsonResponse(false, "Subscription inactive or expired");
}

jsonResponse(true, "Login successful", [
    "product_id" => $product_id,
    "subscription_status" => $user['status'],
    "expires_at" => $user['end_date']
]);
