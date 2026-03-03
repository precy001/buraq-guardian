<?php
/**
 * Paystack Payment Initiation Endpoint
 * 
 * Initializes a Paystack payment session for subscription purchase.
 * Returns authorization URL for frontend redirect.
 * 
 * POST /api/subscriptions/initiate.php
 */

require_once __DIR__ . '/../middleware/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/response.php';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, 'Method not allowed');
}

// Get Paystack secret key from environment
$paystackSecretKey = getenv('PAYSTACK_SECRET_KEY');
if (!$paystackSecretKey) {
    http_response_code(500);
    jsonResponse(false, 'Payment configuration error');
}

// Parse JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    jsonResponse(false, 'Invalid JSON input');
}

// Required fields validation
$requiredFields = ['product_id', 'plan_name', 'amount', 'email', 'duration_days'];
foreach ($requiredFields as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        jsonResponse(false, "Missing required field: $field");
    }
}

$productId = trim($input['product_id']);
$planName = trim($input['plan_name']);
$amount = (int) $input['amount'];
$email = trim($input['email']);
$durationDays = (int) $input['duration_days'];

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    jsonResponse(false, 'Invalid email format');
}

// Validate amount (minimum 100 kobo = ₦1)
if ($amount < 100) {
    http_response_code(400);
    jsonResponse(false, 'Amount must be at least 100 kobo');
}

// Validate duration
if ($durationDays < 1 || $durationDays > 365) {
    http_response_code(400);
    jsonResponse(false, 'Duration must be between 1 and 365 days');
}

try {
    // Verify product exists and is registered
    $stmt = $pdo->prepare("SELECT id FROM products WHERE product_id = ? AND is_registered = 1");
    $stmt->execute([$productId]);
    $product = $stmt->fetch();

    if (!$product) {
        http_response_code(404);
        jsonResponse(false, 'Product not found or not registered');
    }

    // Generate unique reference
    $reference = 'BRQ_' . time() . '_' . bin2hex(random_bytes(8));

    // Prepare Paystack API request
    $paystackUrl = 'https://api.paystack.co/transaction/initialize';
    
    $payload = [
        'email' => $email,
        'amount' => $amount, // Amount in kobo
        'reference' => $reference,
        'callback_url' => $input['callback_url'] ?? null,
        'metadata' => [
            'product_id' => $productId,
            'plan_name' => $planName,
            'duration_days' => $durationDays,
            'custom_fields' => [
                [
                    'display_name' => 'Product ID',
                    'variable_name' => 'product_id',
                    'value' => $productId
                ],
                [
                    'display_name' => 'Plan',
                    'variable_name' => 'plan_name',
                    'value' => $planName
                ]
            ]
        ]
    ];

    // Initialize cURL request to Paystack
    $ch = curl_init($paystackUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
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
        jsonResponse(false, 'Payment service connection failed');
    }

    $result = json_decode($response, true);

    if ($httpCode !== 200 || !$result['status']) {
        http_response_code(502);
        jsonResponse(false, $result['message'] ?? 'Payment initialization failed');
    }

    // Return authorization URL to frontend
    jsonResponse(true, 'Payment initialized successfully', [
        'authorization_url' => $result['data']['authorization_url'],
        'access_code' => $result['data']['access_code'],
        'reference' => $reference
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, 'Database error occurred');
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, 'An unexpected error occurred');
}
