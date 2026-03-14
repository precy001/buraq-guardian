<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

$product_id = $_GET['product_id'] ?? null;
$limit = min((int)($_GET['limit'] ?? 20), 50);
$offset = max((int)($_GET['offset'] ?? 0), 0);

if (!$product_id) {
    sendError('Product ID is required', 400);
}

try {
    $db = getDBConnection();

    $stmt = $db->prepare("
        SELECT id, product_id, alert_type, message, status, created_at as timestamp, acknowledged_at
        FROM drowning_alerts
        WHERE product_id = :product_id
        ORDER BY created_at DESC
        LIMIT :lim OFFSET :off
    ");
    $stmt->bindValue(':product_id', $product_id, PDO::PARAM_STR);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countStmt = $db->prepare("SELECT COUNT(*) FROM drowning_alerts WHERE product_id = :product_id");
    $countStmt->execute(['product_id' => $product_id]);
    $total = (int)$countStmt->fetchColumn();

    sendSuccess(['alerts' => $alerts, 'total' => $total]);
} catch (PDOException $e) {
    sendError('Database error: ' . $e->getMessage(), 500);
}
