<?php
/**
 * View Single User Endpoint
 * GET /api/admin/users/view.php?user_id=1
 * 
 * Returns detailed information about a specific user
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
    
    // Get user identifier (can be user_id or product_id)
    $userId = trim($_GET['user_id'] ?? '');
    $productId = trim($_GET['product_id'] ?? '');
    
    if (empty($userId) && empty($productId)) {
        http_response_code(400);
        jsonResponse(false, "User ID or Product ID is required");
    }
    
    // Get user details
    if (!empty($userId)) {
        $stmt = $pdo->prepare("
            SELECT id, product_id, full_name, email, phone, home_address, created_at
            FROM users
            WHERE id = :user_id
        ");
        $stmt->execute(['user_id' => $userId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT id, product_id, full_name, email, phone, home_address, created_at
            FROM users
            WHERE product_id = :product_id
        ");
        $stmt->execute(['product_id' => $productId]);
    }
    
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        jsonResponse(false, "User not found");
    }
    
    // Get all subscriptions for this user
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
    $stmt->execute(['product_id' => $user['product_id']]);
    $subscriptions = $stmt->fetchAll();
    
    // Calculate stats
    $activeSubscription = null;
    $totalSpent = 0;
    $subscriptionCount = count($subscriptions);
    
    foreach ($subscriptions as $sub) {
        if ($sub['payment_status'] === 'paid') {
            $totalSpent += (float)$sub['amount'];
        }
        if ($sub['status'] === 'active' && strtotime($sub['end_date']) > time()) {
            $activeSubscription = $sub;
        }
    }
    
    // Get product info
    $stmt = $pdo->prepare("SELECT created_at FROM products WHERE product_id = :product_id");
    $stmt->execute(['product_id' => $user['product_id']]);
    $product = $stmt->fetch();
    
    jsonResponse(true, "User details retrieved", [
        'user' => [
            'id' => $user['id'],
            'product_id' => $user['product_id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'home_address' => $user['home_address'],
            'registered_at' => $user['created_at']
        ],
        'product' => [
            'product_id' => $user['product_id'],
            'generated_at' => $product['created_at'] ?? null
        ],
        'subscription' => [
            'active' => $activeSubscription,
            'history' => $subscriptions,
            'stats' => [
                'total_subscriptions' => $subscriptionCount,
                'total_spent' => $totalSpent
            ]
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
