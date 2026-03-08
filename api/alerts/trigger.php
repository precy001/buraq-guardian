<?php
// This endpoint is called by the Buraq device when drowning is detected
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$product_id = $data['product_id'] ?? null;
$message = $data['message'] ?? 'DROWNING DETECTED! Immediate action required!';

if (!$product_id) {
    sendError('Product ID is required', 400);
}

try {
    $db = getDBConnection();
    
    // Verify product exists
    $stmt = $db->prepare("SELECT id FROM users WHERE product_id = :product_id");
    $stmt->execute(['product_id' => $product_id]);
    if (!$stmt->fetch()) {
        sendError('Invalid product ID', 404);
    }

    // Create the alert
    $stmt = $db->prepare("
        INSERT INTO drowning_alerts (product_id, alert_type, message, status, created_at)
        VALUES (:product_id, 'drowning', :message, 'active', NOW())
    ");
    $stmt->execute([
        'product_id' => $product_id,
        'message' => $message,
    ]);

    $alertId = $db->lastInsertId();

    // Send push notifications to all subscribed devices
    require_once __DIR__ . '/../push/send.php';
    $pushStats = sendPushNotifications($product_id, $message);

    sendSuccess([
        'alert_id' => $alertId,
        'message' => 'Drowning alert triggered successfully',
        'push' => $pushStats,
    ]);
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
