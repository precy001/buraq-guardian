<?php
/**
 * List All Subscriptions Endpoint
 * GET /api/admin/subscriptions/index.php
 * 
 * Returns paginated list of all subscriptions with filtering options
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
    
    // Pagination parameters
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(max(1, (int)($_GET['limit'] ?? 20)), 100);
    $offset = ($page - 1) * $limit;
    
    // Filter parameters
    $status = $_GET['status'] ?? 'all'; // all, active, expired, suspended
    $planType = $_GET['plan_type'] ?? 'all'; // all, daily, weekly, monthly, yearly
    $paymentStatus = $_GET['payment_status'] ?? 'all'; // all, paid, pending, failed
    $search = trim($_GET['search'] ?? '');
    $sortBy = $_GET['sort_by'] ?? 'created_at';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'DESC');
    
    // Validate sort parameters
    $allowedSortColumns = ['product_id', 'plan_type', 'amount', 'start_date', 'end_date', 'status', 'created_at'];
    if (!in_array($sortBy, $allowedSortColumns)) {
        $sortBy = 'created_at';
    }
    if (!in_array($sortOrder, ['ASC', 'DESC'])) {
        $sortOrder = 'DESC';
    }
    
    // Build query conditions
    $conditions = [];
    $params = [];
    
    if ($status !== 'all') {
        $conditions[] = "s.status = :status";
        $params['status'] = $status;
    }
    
    if ($planType !== 'all') {
        $conditions[] = "s.plan_type = :plan_type";
        $params['plan_type'] = $planType;
    }
    
    if ($paymentStatus !== 'all') {
        $conditions[] = "s.payment_status = :payment_status";
        $params['payment_status'] = $paymentStatus;
    }
    
    if (!empty($search)) {
        $conditions[] = "(s.product_id LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search)";
        $params['search'] = "%{$search}%";
    }
    
    $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
    
    // Get total count
    $countQuery = "
        SELECT COUNT(*) as total 
        FROM subscriptions s 
        LEFT JOIN users u ON s.product_id = u.product_id 
        {$whereClause}
    ";
    $stmt = $pdo->prepare($countQuery);
    $stmt->execute($params);
    $totalCount = $stmt->fetch()['total'];
    
    // Get subscriptions with user info
    $query = "
        SELECT 
            s.id,
            s.product_id,
            s.plan_type,
            s.amount,
            s.start_date,
            s.end_date,
            s.status,
            s.payment_status,
            s.payment_reference,
            s.created_at,
            u.full_name as user_name,
            u.email as user_email
        FROM subscriptions s
        LEFT JOIN users u ON s.product_id = u.product_id
        {$whereClause}
        ORDER BY s.{$sortBy} {$sortOrder}
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $subscriptions = $stmt->fetchAll();
    
    // Format and calculate additional info
    $formattedSubscriptions = array_map(function($sub) {
        $endDate = strtotime($sub['end_date']);
        $now = time();
        $isExpired = $endDate < $now;
        $daysRemaining = $isExpired ? 0 : ceil(($endDate - $now) / 86400);
        
        return [
            'id' => $sub['id'],
            'product_id' => $sub['product_id'],
            'plan_type' => $sub['plan_type'],
            'amount' => (float)$sub['amount'],
            'start_date' => $sub['start_date'],
            'end_date' => $sub['end_date'],
            'days_remaining' => $daysRemaining,
            'status' => $sub['status'],
            'payment_status' => $sub['payment_status'],
            'payment_reference' => $sub['payment_reference'],
            'created_at' => $sub['created_at'],
            'user' => $sub['user_name'] ? [
                'name' => $sub['user_name'],
                'email' => $sub['user_email']
            ] : null,
            'is_expired' => $isExpired
        ];
    }, $subscriptions);
    
    jsonResponse(true, "Subscriptions retrieved successfully", [
        'subscriptions' => $formattedSubscriptions,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_count' => (int)$totalCount,
            'total_pages' => ceil($totalCount / $limit)
        ],
        'filters' => [
            'status' => $status,
            'plan_type' => $planType,
            'payment_status' => $paymentStatus,
            'search' => $search,
            'sort_by' => $sortBy,
            'sort_order' => $sortOrder
        ]
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, "Database error occurred");
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, "An unexpected error occurred");
}
