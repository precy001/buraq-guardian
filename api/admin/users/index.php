<?php
/**
 * List All Users Endpoint
 * GET /api/admin/users/index.php
 * 
 * Returns paginated list of all registered users
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
    $search = trim($_GET['search'] ?? '');
    $subscriptionStatus = $_GET['subscription_status'] ?? 'all'; // all, active, expired, suspended, none
    $sortBy = $_GET['sort_by'] ?? 'created_at';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'DESC');
    
    // Validate sort parameters
    $allowedSortColumns = ['full_name', 'email', 'product_id', 'created_at'];
    if (!in_array($sortBy, $allowedSortColumns)) {
        $sortBy = 'created_at';
    }
    if (!in_array($sortOrder, ['ASC', 'DESC'])) {
        $sortOrder = 'DESC';
    }
    
    // Build base query
    $conditions = [];
    $params = [];
    
    if (!empty($search)) {
        $conditions[] = "(u.full_name LIKE :search OR u.email LIKE :search OR u.product_id LIKE :search OR u.phone LIKE :search)";
        $params['search'] = "%{$search}%";
    }
    
    // Handle subscription status filter in HAVING clause
    $havingClause = '';
    if ($subscriptionStatus === 'active') {
        $havingClause = "HAVING subscription_status = 'active'";
    } elseif ($subscriptionStatus === 'expired') {
        $havingClause = "HAVING subscription_status = 'expired'";
    } elseif ($subscriptionStatus === 'suspended') {
        $havingClause = "HAVING subscription_status = 'suspended'";
    } elseif ($subscriptionStatus === 'none') {
        $havingClause = "HAVING subscription_status IS NULL";
    }
    
    $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
    
    // Get total count (without HAVING for accurate pagination)
    $countQuery = "SELECT COUNT(*) as total FROM users u {$whereClause}";
    $stmt = $pdo->prepare($countQuery);
    $stmt->execute($params);
    $totalCount = $stmt->fetch()['total'];
    
    // Get users with subscription info
    $query = "
        SELECT 
            u.id,
            u.product_id,
            u.full_name,
            u.email,
            u.phone,
            u.home_address,
            u.created_at,
            (
                SELECT s.status 
                FROM subscriptions s 
                WHERE s.product_id = u.product_id 
                ORDER BY s.created_at DESC 
                LIMIT 1
            ) as subscription_status,
            (
                SELECT s.end_date 
                FROM subscriptions s 
                WHERE s.product_id = u.product_id 
                AND s.status = 'active'
                ORDER BY s.created_at DESC 
                LIMIT 1
            ) as subscription_end_date,
            (
                SELECT s.plan_type 
                FROM subscriptions s 
                WHERE s.product_id = u.product_id 
                ORDER BY s.created_at DESC 
                LIMIT 1
            ) as current_plan
        FROM users u
        {$whereClause}
        {$havingClause}
        ORDER BY u.{$sortBy} {$sortOrder}
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $users = $stmt->fetchAll();
    
    // Format response
    $formattedUsers = array_map(function($user) {
        $isActive = $user['subscription_status'] === 'active' && 
                    $user['subscription_end_date'] && 
                    strtotime($user['subscription_end_date']) > time();
        
        return [
            'id' => $user['id'],
            'product_id' => $user['product_id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'home_address' => $user['home_address'],
            'created_at' => $user['created_at'],
            'subscription' => [
                'status' => $isActive ? 'active' : ($user['subscription_status'] ?? 'none'),
                'plan' => $user['current_plan'],
                'end_date' => $user['subscription_end_date']
            ]
        ];
    }, $users);
    
    jsonResponse(true, "Users retrieved successfully", [
        'users' => $formattedUsers,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_count' => (int)$totalCount,
            'total_pages' => ceil($totalCount / $limit)
        ],
        'filters' => [
            'search' => $search,
            'subscription_status' => $subscriptionStatus,
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
