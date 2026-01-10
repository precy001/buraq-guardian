<?php
/**
 * List All Products Endpoint
 * GET /api/admin/products/index.php
 */

require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../utils/response.php';
require_once __DIR__ . '/../../middleware/admin_auth.php';

/**
 * --------------------------------------------------
 * METHOD CHECK
 * --------------------------------------------------
 */
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    jsonResponse(false, 'Method not allowed');
}

try {
    /**
     * --------------------------------------------------
     * AUTH
     * --------------------------------------------------
     */
    $admin = validateAdminToken();

    /**
     * --------------------------------------------------
     * PAGINATION
     * --------------------------------------------------
     */
    $page  = max(1, (int)($_GET['page'] ?? 1));
    $limit = min(max(1, (int)($_GET['limit'] ?? 20)), 100);
    $offset = ($page - 1) * $limit;

    /**
     * --------------------------------------------------
     * FILTERS
     * --------------------------------------------------
     */
    $filter = $_GET['filter'] ?? 'all';
    $search = trim($_GET['search'] ?? '');
    $sortBy = $_GET['sort_by'] ?? 'created_at';
    $sortOrder = strtoupper($_GET['sort_order'] ?? 'DESC');

    /**
     * --------------------------------------------------
     * SORT VALIDATION
     * --------------------------------------------------
     */
    $allowedSortColumns = ['product_id', 'is_registered', 'created_at'];
    if (!in_array($sortBy, $allowedSortColumns)) {
        $sortBy = 'created_at';
    }

    if (!in_array($sortOrder, ['ASC', 'DESC'])) {
        $sortOrder = 'DESC';
    }

    /**
     * --------------------------------------------------
     * BUILD CONDITIONS (NO WHERE / AND HERE)
     * --------------------------------------------------
     */
    $conditions = [];
    $params = [];

    if ($filter === 'registered') {
        $conditions[] = 'p.is_registered = 1';
    } elseif ($filter === 'unregistered') {
        $conditions[] = 'p.is_registered = 0';
    }

    if ($search !== '') {
        $conditions[] = 'p.product_id LIKE :search';
        $params['search'] = "%{$search}%";
    }

    $whereSql = '';
    if (!empty($conditions)) {
        $whereSql = 'WHERE ' . implode(' AND ', $conditions);
    }

    /**
     * --------------------------------------------------
     * TOTAL COUNT QUERY (FIXED)
     * --------------------------------------------------
     */
    $countSql = "
        SELECT COUNT(*) AS total
        FROM products p
        {$whereSql}
    ";

    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $totalCount = (int)$stmt->fetch()['total'];

    /**
     * --------------------------------------------------
     * MAIN QUERY (FIXED)
     * --------------------------------------------------
     */
    $query = "
        SELECT 
            p.*,
            u.full_name AS user_name,
            u.email AS user_email,
            s.status AS subscription_status,
            s.plan_name,
            s.end_date AS expiry_date,
            DATEDIFF(s.end_date, NOW()) AS days_remaining
        FROM products p
        LEFT JOIN users u 
            ON p.product_id = u.product_id
        LEFT JOIN subscriptions s 
            ON p.product_id = s.product_id
           AND s.status = 'active'
        {$whereSql}
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

    /**
     * --------------------------------------------------
     * FORMAT RESPONSE
     * --------------------------------------------------
     */
    $formattedProducts = array_map(function ($product) {
        return [
            'id' => $product['id'],
            'product_id' => $product['product_id'],
            'is_registered' => (bool)$product['is_registered'],
            'created_at' => $product['created_at'],
            'subscription_status' => $product['subscription_status'] ?? null,
            'plan_name' => $product['plan_name'] ?? '-',
            'expiry_date' => $product['expiry_date'] ?? null,
            'days_remaining' => isset($product['days_remaining'])
                ? (int)$product['days_remaining']
                : null,
            'user' => $product['user_name']
                ? [
                    'name' => $product['user_name'],
                    'email' => $product['user_email']
                ]
                : null
        ];
    }, $products);

    jsonResponse(true, 'Products retrieved successfully', [
        'products' => $formattedProducts,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_count' => $totalCount,
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
    jsonResponse(false, 'Database error');
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, 'Unexpected server error');
}
