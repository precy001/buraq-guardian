<?php
/**
 * Create Manual Subscription Endpoint
 * POST /api/admin/subscriptions/create.php
 * 
 * Allows admins to manually create a subscription for a user (e.g., for testing or special cases)
 */

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../middleware/admin_auth.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, "Method not allowed");
}

try {
    // Validate admin authentication
    $admin = validateAdminToken();
    
    // Parse JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        jsonResponse(false, "Invalid JSON payload");
    }
    
    // Validate required fields
    $productId = trim($input['product_id'] ?? '');
    $planType = strtolower(trim($input['plan_type'] ?? ''));
    $reason = trim($input['reason'] ?? 'Admin created');
    
    if (empty($productId)) {
        http_response_code(400);
        jsonResponse(false, "Product ID is required");
    }
    
    // Validate plan type
    $validPlans = [
        'daily' => ['days' => 1, 'amount' => 10000],
        'weekly' => ['days' => 7, 'amount' => 30000],
        'monthly' => ['days' => 30, 'amount' => 50000],
        'yearly' => ['days' => 365, 'amount' => 550000]
    ];
    
    if (!isset($validPlans[$planType])) {
        http_response_code(400);
        jsonResponse(false, "Invalid plan type. Allowed: " . implode(', ', array_keys($validPlans)));
    }
    
    // Verify product exists and is registered
    $stmt = $pdo->prepare("SELECT * FROM products WHERE product_id = :product_id");
    $stmt->execute(['product_id' => $productId]);
    $product = $stmt->fetch();
    
    if (!$product) {
        http_response_code(404);
        jsonResponse(false, "Product not found");
    }
    
    if (!$product['is_registered']) {
        http_response_code(400);
        jsonResponse(false, "Product is not registered yet. User must register first.");
    }
    
    // Verify user exists
    $stmt = $pdo->prepare("SELECT * FROM users WHERE product_id = :product_id");
    $stmt->execute(['product_id' => $productId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        jsonResponse(false, "User not found for this product");
    }
    
    $pdo->beginTransaction();
    
    // Expire any existing active subscriptions
    $stmt = $pdo->prepare("
        UPDATE subscriptions 
        SET status = 'expired', updated_at = NOW() 
        WHERE product_id = :product_id AND status = 'active'
    ");
    $stmt->execute(['product_id' => $productId]);
    
    // Create new subscription
    $plan = $validPlans[$planType];
    $startDate = date('Y-m-d H:i:s');
    $endDate = date('Y-m-d H:i:s', strtotime("+{$plan['days']} days"));
    $amount = $input['amount'] ?? $plan['amount']; // Allow custom amount
    
    $stmt = $pdo->prepare("
        INSERT INTO subscriptions (
            product_id, plan_type, amount, start_date, end_date, 
            status, payment_status, payment_reference, created_at
        ) VALUES (
            :product_id, :plan_type, :amount, :start_date, :end_date,
            'active', 'paid', :payment_reference, NOW()
        )
    ");
    
    $paymentRef = 'ADMIN-' . strtoupper(bin2hex(random_bytes(8)));
    
    $stmt->execute([
        'product_id' => $productId,
        'plan_type' => $planType,
        'amount' => $amount,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'payment_reference' => $paymentRef
    ]);
    
    $subscriptionId = $pdo->lastInsertId();
    
    // Log admin action
    $stmt = $pdo->prepare("
        INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
        VALUES (:admin_id, 'create_subscription', :details, :ip_address)
    ");
    $stmt->execute([
        'admin_id' => $admin['admin_id'],
        'details' => json_encode([
            'subscription_id' => $subscriptionId,
            'product_id' => $productId,
            'plan_type' => $planType,
            'amount' => $amount,
            'reason' => $reason
        ]),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
    ]);
    
    $pdo->commit();
    
    // Get created subscription
    $stmt = $pdo->prepare("SELECT * FROM subscriptions WHERE id = :id");
    $stmt->execute(['id' => $subscriptionId]);
    $subscription = $stmt->fetch();
    
    jsonResponse(true, "Subscription created successfully", [
        'subscription' => $subscription,
        'user' => [
            'full_name' => $user['full_name'],
            'email' => $user['email']
        ]
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
