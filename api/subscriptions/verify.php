<?php
/**
 * Paystack Payment Verification Endpoint
 * 
 * Verifies payment with Paystack and creates subscription record.
 * This is the CRITICAL endpoint - only verified payments create subscriptions.
 * 
 * GET /api/subscriptions/verify.php?reference=XXXX
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

// Accept both GET and POST for flexibility
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'])) {
    http_response_code(405);
    jsonResponse(false, 'Method not allowed');
}

// Get Paystack secret key from environment
$paystackSecretKey = "sk_test_61bfc65b453de719dbe11751047a7d69a1fe8725";
if (!$paystackSecretKey) {
    http_response_code(500);
    jsonResponse(false, 'Payment configuration error');
}

// Get reference from query string or POST body
$reference = $_GET['reference'] ?? null;

if (!$reference && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $reference = $input['reference'] ?? null;
}

if (!$reference) {
    http_response_code(400);
    jsonResponse(false, 'Payment reference is required');
}

// Sanitize reference
$reference = trim($reference);
if (!preg_match('/^[a-zA-Z0-9_-]+$/', $reference)) {
    http_response_code(400);
    jsonResponse(false, 'Invalid reference format');
}

try {
    // IDEMPOTENCY CHECK: Prevent duplicate transactions
    // Check if this reference has already been processed
    $stmt = $pdo->prepare("
        SELECT id, product_id, plan_name, status 
        FROM subscriptions 
        WHERE payment_reference = ?
    ");
    $stmt->execute([$reference]);
    $existingSubscription = $stmt->fetch();

    if ($existingSubscription) {
        // Already processed - return existing subscription info
        jsonResponse(true, 'Payment already verified', [
            'subscription_id' => $existingSubscription['id'],
            'product_id' => $existingSubscription['product_id'],
            'plan_name' => $existingSubscription['plan_name'],
            'status' => $existingSubscription['status'],
            'already_processed' => true
        ]);
    }

    // Verify payment with Paystack
    $paystackUrl = 'https://api.paystack.co/transaction/verify/' . urlencode($reference);

    $ch = curl_init($paystackUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $paystackSecretKey,
            'Content-Type: application/json',
            'Cache-Control: no-cache'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        http_response_code(500);
        jsonResponse(false, 'Payment verification service unavailable');
    }

    $result = json_decode($response, true);

    if ($httpCode !== 200 || !$result['status']) {
        http_response_code(400);
        jsonResponse(false, $result['message'] ?? 'Payment verification failed');
    }

    $transactionData = $result['data'];

    // CRITICAL: Verify payment status is 'success'
    if ($transactionData['status'] !== 'success') {
        http_response_code(400);
        jsonResponse(false, 'Payment was not successful', [
            'payment_status' => $transactionData['status']
        ]);
    }

    // Extract metadata
    $metadata = $transactionData['metadata'] ?? [];
    $productId = $metadata['product_id'] ?? null;
    $planName = $metadata['plan_name'] ?? null;
    $durationDays = (int) ($metadata['duration_days'] ?? 30);

    if (!$productId || !$planName) {
        http_response_code(400);
        jsonResponse(false, 'Invalid payment metadata');
    }

    // Verify the product exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE product_id = ?");
    $stmt->execute([$productId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        jsonResponse(false, 'Product not found');
    }

    // Verify currency (should be NGN)
    if ($transactionData['currency'] !== 'NGN') {
        http_response_code(400);
        jsonResponse(false, 'Invalid payment currency');
    }

    // Begin database transaction for atomic operations
    $pdo->beginTransaction();

    try {
        // Check for an existing active subscription
$stmt = $pdo->prepare("
    SELECT id, end_date 
    FROM subscriptions 
    WHERE product_id = ? AND status = 'active'
    ORDER BY end_date DESC
    LIMIT 1
");
$stmt->execute([$productId]);
$activeSubscription = $stmt->fetch();

if ($activeSubscription) {
    // APPEND: start from existing end_date
    $startDate = $activeSubscription['end_date'];
    $endDate   = date('Y-m-d H:i:s', strtotime($startDate . " +{$durationDays} days"));

    // Mark old record as extended (optional but clean)
    $stmt = $pdo->prepare("
        UPDATE subscriptions 
        SET status = 'expired'
        WHERE id = ?
    ");
    $stmt->execute([$activeSubscription['id']]);
} else {
    // NEW subscription
    $startDate = date('Y-m-d H:i:s');
    $endDate   = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));
}

        // Insert new subscription record
        $stmt = $pdo->prepare("
            INSERT INTO subscriptions (
                product_id, 
                plan_name, 
                start_date, 
                end_date, 
                status, 
                payment_reference,
                amount_paid,
                created_at
            ) VALUES (?, ?, ?, ?, 'active', ?, ?, NOW())
        ");
        
        $stmt->execute([
            $productId,
            $planName,
            $startDate,
            $endDate,
            $reference,
            $transactionData['amount'] // Amount in kobo
        ]);

        $subscriptionId = $pdo->lastInsertId();

        // Commit transaction
        $pdo->commit();

        // Calculate days remaining for response
       $daysRemaining = ceil(
            (strtotime($endDate) - time()) / 86400
        );


        jsonResponse(true, 'Payment verified and subscription activated', [
            'subscription' => [
                'id' => $subscriptionId,
                'product_id' => $productId,
                'plan_name' => $planName,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => 'active',
                'days_remaining' => $daysRemaining,
                'total_days' => $durationDays
            ],
            'payment' => [
                'reference' => $reference,
                'amount' => $transactionData['amount'],
                'currency' => $transactionData['currency'],
                'paid_at' => $transactionData['paid_at'] ?? null
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, 'Database error occurred');
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, 'An unexpected error occurred');
}
