<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

$data = json_decode(file_get_contents('php://input'), true);
$alert_id = $data['alert_id'] ?? null;
$product_id = $data['product_id'] ?? null;

if (!$alert_id || !$product_id) {
    sendError('Alert ID and Product ID are required', 400);
}

try {
    $db = getDBConnection();
    
    $stmt = $db->prepare("
        UPDATE drowning_alerts 
        SET status = 'acknowledged', acknowledged_at = NOW()
        WHERE id = :alert_id AND product_id = :product_id
    ");
    $stmt->execute([
        'alert_id' => $alert_id,
        'product_id' => $product_id,
    ]);

    sendSuccess(['message' => 'Alert acknowledged']);
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
