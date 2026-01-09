<?php
/**
 * View Single Product Endpoint
 * GET /api/admin/products/view.php?product_id=BRQ-2026-XXXXXX
 * 
 * Returns detailed information about a specific product
 */

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../middleware/admin_auth.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

try {
    // Validate admin authentication
    $admin = validateAdminToken();
    
    // Get product_id from query string
    $productId = trim($_GET['product_id'] ?? '');
    
    if (empty($productId)) {
        http_response_code(400);
        jsonResponse(false, "Product ID is required");
    }
    
    // Get product details
    $stmt = $pdo->prepare("
        SELECT 
            p.id,
            p.product_id,
            p.is_registered,
            p.created_at
        FROM products p
        WHERE p.product_id = :product_id
    ");
    $stmt->execute(['product_id' => $productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        http_response_code(404);
        jsonResponse(false, "Product not found");
    }
    
    // Get user info if registered
    $user = null;
    if ($product['is_registered']) {
        $stmt = $pdo->prepare("
            SELECT id, full_name, email, phone, home_address, created_at
            FROM users
            WHERE product_id = :product_id
        ");
        $stmt->execute(['product_id' => $productId]);
        $user = $stmt->fetch();
    }
    
    // Get subscription history
    $stmt = $pdo->prepare("
        SELECT 
            id,
            plan_type,
            amount,
            start_date,
            end_date,
            status,
            payment_status,
            payment_reference,
            created_at
        FROM subscriptions
        WHERE product_id = :product_id
        ORDER BY created_at DESC
    ");
    $stmt->execute(['product_id' => $productId]);
    $subscriptions = $stmt->fetchAll();
    
    // Calculate subscription stats
    $activeSubscription = null;
    $totalSpent = 0;
    foreach ($subscriptions as $sub) {
        if ($sub['payment_status'] === 'paid') {
            $totalSpent += (float)$sub['amount'];
        }
        if ($sub['status'] === 'active' && strtotime($sub['end_date']) > time()) {
            $activeSubscription = $sub;
        }
    }
    
    jsonResponse(true, "Product details retrieved", [
        'product' => [
            'id' => $product['id'],
            'product_id' => $product['product_id'],
            'is_registered' => (bool)$product['is_registered'],
            'created_at' => $product['created_at']
        ],
        'user' => $user,
        'subscription' => [
            'active' => $activeSubscription,
            'history' => $subscriptions,
            'total_spent' => $totalSpent
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
