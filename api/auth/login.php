<?php
require "../config/database.php";
require "../utils/response.php";
require "../middleware/cors.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    jsonResponse(false, "Invalid JSON payload");
}

$product_id = $data['product_id'] ?? null;
$password   = $data['password'] ?? null;

if (!$product_id || !$password) {
    jsonResponse(false, "Product ID and password required");
}

/* Fetch user with subscription data */
$stmt = $pdo->prepare("
    SELECT u.id,
           u.product_id,
           u.full_name,
           u.email,
           u.phone,
           u.home_address,
           u.password_hash,
           s.id as subscription_id,
           s.plan_name,
           s.status as subscription_status,
           s.start_date,
           s.end_date
    FROM users u
    LEFT JOIN subscriptions s 
        ON s.id = (
            SELECT s2.id
            FROM subscriptions s2
            WHERE s2.product_id = u.product_id
            ORDER BY 
                CASE 
                    WHEN s2.status = 'active' AND s2.end_date > NOW() THEN 1
                    WHEN s2.status = 'suspended' AND s2.end_date > NOW() THEN 2
                    ELSE 3
                END,
                s2.end_date DESC,
                s2.created_at DESC
            LIMIT 1
        )
    WHERE u.product_id = ?
");
$stmt->execute([$product_id]);

$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    jsonResponse(false, "Invalid credentials");
}

/* Calculate subscription details */
$subscriptionData = null;
if ($user['subscription_id']) {
    $startDate = strtotime($user['start_date']);
    $endDate = strtotime($user['end_date']);
    $now = time();
    
    $totalDays = max(1, ceil(($endDate - $startDate) / 86400));
    $daysRemaining = max(0, ceil(($endDate - $now) / 86400));
    
    // Determine subscription status
    // - active: must be active AND not past end date
    // - suspended: preserve admin suspension while still within end date
    // - expired: anything else
    $status = 'expired';
    if ($user['subscription_status'] === 'suspended' && $endDate >= $now) {
        $status = 'suspended';
    } elseif ($user['subscription_status'] === 'active' && $endDate >= $now) {
        $status = 'active';
    }

    $subscriptionData = [
        'id' => $user['subscription_id'],
        'plan_name' => $user['plan_name'],
        'status' => $status,
        'start_date' => $user['start_date'],
        'end_date' => $user['end_date'],
        'days_remaining' => $daysRemaining,
        'total_days' => $totalDays
    ];
}

jsonResponse(true, "Login successful", [
    'user' => [
        'id' => $user['id'],
        'product_id' => $user['product_id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'home_address' => $user['home_address']
    ],
    'subscription' => $subscriptionData
]);
