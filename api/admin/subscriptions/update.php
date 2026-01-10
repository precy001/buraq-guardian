<?php
/**
 * Update Subscription Status Endpoint
 * POST /api/admin/subscriptions/update.php
 * 
 * Allows admins to manually activate, suspend, or expire subscriptions
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
    $subscriptionId = $input['subscription_id'] ?? null;
    $productId = $input['product_id'] ?? null;
    $action = strtolower(trim($input['action'] ?? ''));
    $reason = trim($input['reason'] ?? '');
    
    // Must have either subscription_id or product_id
    if (!$subscriptionId && !$productId) {
        http_response_code(400);
        jsonResponse(false, "Subscription ID or Product ID is required");
    }
    
    // Validate action
    $allowedActions = ['activate', 'suspend', 'expire', 'extend'];
    if (!in_array($action, $allowedActions)) {
        http_response_code(400);
        jsonResponse(false, "Invalid action. Allowed: " . implode(', ', $allowedActions));
    }
    
    // Get the subscription to update
    if ($subscriptionId) {
        $stmt = $pdo->prepare("SELECT * FROM subscriptions WHERE id = :id");
        $stmt->execute(['id' => $subscriptionId]);
    } else {
        // Get the most recent subscription for the product
        $stmt = $pdo->prepare("
            SELECT * FROM subscriptions 
            WHERE product_id = :product_id 
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute(['product_id' => $productId]);
    }
    
    $subscription = $stmt->fetch();
    
    if (!$subscription) {
        http_response_code(404);
        jsonResponse(false, "Subscription not found");
    }
    
    $pdo->beginTransaction();
    
    $updates = [];
    $newStatus = $subscription['status'];
    $newEndDate = $subscription['end_date'];
    
    switch ($action) {
        case 'activate':
            $newStatus = 'active';
            // If subscription was expired/suspended with past end date, extend it
            if (strtotime($subscription['end_date']) < time()) {
                // Calculate days based on plan type and extend from now
                $days = getPlanDays($subscription['plan_type']);
                $newEndDate = date('Y-m-d H:i:s', strtotime("+{$days} days"));
            }
            break;
            
        case 'suspend':
            $newStatus = 'suspended';
            break;
            
        case 'expire':
            $newStatus = 'expired';
            $newEndDate = date('Y-m-d H:i:s'); // Set end date to now
            break;
            
        case 'extend':
            // Extend subscription by the plan duration
            $days = (int)($input['days'] ?? getPlanDays($subscription['plan_type']));
            if ($days < 1 || $days > 365) {
                $pdo->rollBack();
                http_response_code(400);
                jsonResponse(false, "Extension days must be between 1 and 365");
            }
            $baseDate = strtotime($subscription['end_date']) > time() 
                ? $subscription['end_date'] 
                : 'now';
            $newEndDate = date('Y-m-d H:i:s', strtotime("+{$days} days", strtotime($baseDate)));
            $newStatus = 'active';
            break;
    }
    
    // Update the subscription
    $stmt = $pdo->prepare("
        UPDATE subscriptions 
        SET status = :status, end_date = :end_date, updated_at = NOW()
        WHERE id = :id
    ");
    $stmt->execute([
        'status' => $newStatus,
        'end_date' => $newEndDate,
        'id' => $subscription['id']
    ]);
    
    // Log admin action
    $stmt = $pdo->prepare("
        INSERT INTO admin_activity_log (admin_id, action, details, ip_address)
        VALUES (:admin_id, :action, :details, :ip_address)
    ");
    $stmt->execute([
        'admin_id' => $admin['admin_id'],
        'action' => "subscription_{$action}",
        'details' => json_encode([
            'subscription_id' => $subscription['id'],
            'product_id' => $subscription['product_id'],
            'previous_status' => $subscription['status'],
            'new_status' => $newStatus,
            'previous_end_date' => $subscription['end_date'],
            'new_end_date' => $newEndDate,
            'reason' => $reason
        ]),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null
    ]);
    
    $pdo->commit();
    
    // Get updated subscription
    $stmt = $pdo->prepare("SELECT * FROM subscriptions WHERE id = :id");
    $stmt->execute(['id' => $subscription['id']]);
    $updatedSubscription = $stmt->fetch();
    
    jsonResponse(true, "Subscription {$action}d successfully", [
        'subscription' => $updatedSubscription,
        'changes' => [
            'previous_status' => $subscription['status'],
            'new_status' => $newStatus,
            'previous_end_date' => $subscription['end_date'],
            'new_end_date' => $newEndDate
        ]
    ]);
    
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "DB Error: " . $e->getMessage());
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}

/**
 * Get number of days for a subscription plan
 */
function getPlanDays($planType) {
    $plans = [
        'daily' => 1,
        'weekly' => 7,
        'monthly' => 30,
        'yearly' => 365
    ];
    return $plans[strtolower($planType)] ?? 30;
}
