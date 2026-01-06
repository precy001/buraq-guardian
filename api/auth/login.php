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
    LEFT JOIN subscriptions s ON u.product_id = s.product_id
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
    
    // Determine if subscription is active
    $isActive = $user['subscription_status'] === 'active' && $endDate >= $now;
    
    $subscriptionData = [
        'id' => $user['subscription_id'],
        'plan_name' => $user['plan_name'],
        'status' => $isActive ? 'active' : 'expired',
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
