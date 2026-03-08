<?php
// Store push notification subscriptions
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$product_id = $data['product_id'] ?? null;
$subscription = $data['subscription'] ?? null;

if (!$product_id || !$subscription) {
    sendError('Product ID and subscription are required', 400);
}

try {
    $db = getDBConnection();

    // Create table if not exists
    $db->exec("
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id VARCHAR(50) NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT,
            auth TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_product_id (product_id)
        )
    ");

    $endpoint = $subscription['endpoint'] ?? '';
    $p256dh = $subscription['keys']['p256dh'] ?? '';
    $auth = $subscription['keys']['auth'] ?? '';

    // Remove existing subscription for this endpoint (avoid duplicates)
    $stmt = $db->prepare("DELETE FROM push_subscriptions WHERE endpoint = :endpoint");
    $stmt->execute(['endpoint' => $endpoint]);

    // Insert new subscription
    $stmt = $db->prepare("
        INSERT INTO push_subscriptions (product_id, endpoint, p256dh, auth)
        VALUES (:product_id, :endpoint, :p256dh, :auth)
    ");
    $stmt->execute([
        'product_id' => $product_id,
        'endpoint' => $endpoint,
        'p256dh' => $p256dh,
        'auth' => $auth,
    ]);

    sendSuccess(['message' => 'Push subscription saved']);
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
