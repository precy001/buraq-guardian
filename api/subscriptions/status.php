<?php
/**
 * Device Subscription Status Endpoint
 * 
 * Returns the current subscription status for a device.
 * Used by IoT devices to verify activation is allowed.
 * 
 * GET /api/subscriptions/status.php?product_id=XXXX
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, 'Method not allowed');
}

$productId = $_GET['product_id'] ?? null;

if (!$productId) {
    http_response_code(400);
    jsonResponse(false, 'Product ID is required');
}

// Sanitize product ID
$productId = trim($productId);

try {
    // First verify the product exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE product_id = ?");
    $stmt->execute([$productId]);
    
    if (!$stmt->fetch()) {
        http_response_code(404);
        jsonResponse(false, 'Product not registered');
    }

    // Check for active subscription
    $stmt = $pdo->prepare("
        SELECT 
            id,
            plan_name,
            start_date,
            end_date,
            status,
            DATEDIFF(end_date, NOW()) as days_remaining,
            DATEDIFF(end_date, start_date) as total_days
        FROM subscriptions 
        WHERE product_id = ? 
        AND status = 'active'
        AND end_date > NOW()
        ORDER BY end_date DESC
        LIMIT 1
    ");
    $stmt->execute([$productId]);
    $subscription = $stmt->fetch();

    if ($subscription && $subscription['days_remaining'] >= 0) {
        // Active subscription found - device can activate
        jsonResponse(true, 'Subscription active', [
            'can_activate' => true,
            'subscription' => [
                'id' => $subscription['id'],
                'plan_name' => $subscription['plan_name'],
                'start_date' => $subscription['start_date'],
                'end_date' => $subscription['end_date'],
                'status' => 'active',
                'days_remaining' => max(0, (int) $subscription['days_remaining']),
                'total_days' => (int) $subscription['total_days']
            ]
        ]);
    } else {
        // No active subscription - device cannot activate
        // Auto-expire any subscriptions that have passed their end date
        $stmt = $pdo->prepare("
            UPDATE subscriptions 
            SET status = 'expired' 
            WHERE product_id = ? 
            AND status = 'active' 
            AND end_date < NOW()
        ");
        $stmt->execute([$productId]);

        jsonResponse(true, 'No active subscription', [
            'can_activate' => false,
            'subscription' => null
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, 'Database error occurred');
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, 'An unexpected error occurred');
}
