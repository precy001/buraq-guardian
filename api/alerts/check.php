<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../utils/response.php';

// Only GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$product_id = $_GET['product_id'] ?? null;

if (!$product_id) {
    sendError('Product ID is required', 400);
}

try {
    $db = getDBConnection();
    
    // Check for active (unacknowledged) drowning alerts
    $stmt = $db->prepare("
        SELECT id, product_id, alert_type, message, status, created_at as timestamp
        FROM drowning_alerts
        WHERE product_id = :product_id 
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmt->execute(['product_id' => $product_id]);
    $alert = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($alert) {
        sendSuccess(['alert' => $alert]);
    } else {
        sendSuccess(['alert' => null]);
    }
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
