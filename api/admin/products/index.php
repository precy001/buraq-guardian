<?php
/**
 * List All Products Endpoint
 * GET /api/admin/products/index.php
 * 
 * Returns paginated list of all products with filtering options
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
    $limit = min(max(1, (int)($_GET['limit'] ?? 20)), 100); // Max 100 per page
    $offset = ($page - 1) * $limit;
    
    // Filter parameters
    $filter = $_GET['filter'] ?? 'all'; // all, registered, unregistered
    $search = trim($_GET['search'] ?? '');
    $sortBy = $_GET['sort_by'] ?? 'created_at';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'DESC');
    
    // Validate sort parameters
    $allowedSortColumns = ['product_id', 'is_registered', 'created_at'];
    if (!in_array($sortBy, $allowedSortColumns)) {
        $sortBy = 'created_at';
    }
    if (!in_array($sortOrder, ['ASC', 'DESC'])) {
        $sortOrder = 'DESC';
    }
    
    // Build query conditions
    $conditions = [];
    $params = [];
    
    if ($filter === 'registered') {
        $conditions[] = "p.is_registered = 1";
    } elseif ($filter === 'unregistered') {
        $conditions[] = "p.is_registered = 0";
    }
    
    if (!empty($search)) {
        $conditions[] = "p.product_id LIKE :search";
        $params['search'] = "%{$search}%";
    }
    
    $whereClause = !empty($conditions) ? 'WHERE ' . implode(' AND ', $conditions) : '';
    
    // Get total count
    $countQuery = "SELECT COUNT(*) as total FROM products p {$whereClause}";
    $stmt = $pdo->prepare($countQuery);
    $stmt->execute($params);
    $totalCount = $stmt->fetch()['total'];
    
    // Get products with user info if registered
    $query = "
        SELECT 
            p.id,
            p.product_id,
            p.is_registered,
            p.created_at,
            u.id as user_id,
            u.full_name as user_name,
            u.email as user_email,
            u.phone as user_phone,
            (
                SELECT s.status 
                FROM subscriptions s 
                WHERE s.product_id = p.product_id 
                ORDER BY s.created_at DESC 
                LIMIT 1
            ) as subscription_status
        FROM products p
        LEFT JOIN users u ON p.product_id = u.product_id
        {$whereClause}
        ORDER BY p.{$sortBy} {$sortOrder}
        LIMIT :limit OFFSET :offset
    ";
    
    $stmt = $pdo->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    
    $products = $stmt->fetchAll();
    
    // Format response
    $formattedProducts = array_map(function($product) {
        return [
            'id' => $product['id'],
            'product_id' => $product['product_id'],
            'is_registered' => (bool)$product['is_registered'],
            'created_at' => $product['created_at'],
            'user' => $product['user_id'] ? [
                'id' => $product['user_id'],
                'name' => $product['user_name'],
                'email' => $product['user_email'],
                'phone' => $product['user_phone']
            ] : null,
            'subscription_status' => $product['subscription_status']
        ];
    }, $products);
    
    jsonResponse(true, "Products retrieved successfully", [
        'products' => $formattedProducts,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_count' => (int)$totalCount,
            'total_pages' => ceil($totalCount / $limit)
        ],
        'filters' => [
            'filter' => $filter,
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
