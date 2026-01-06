<?php
require "../config/database.php";
require "../utils/response.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    jsonResponse(false, "Invalid JSON payload");
}

extract($data);

if (
    empty($product_id) || empty($full_name) || empty($email) ||
    empty($password) || empty($confirm_password)
) {
    jsonResponse(false, "All required fields must be filled");
}

if ($password !== $confirm_password) {
    jsonResponse(false, "Passwords do not match");
}

/* Check product exists and is not registered */
$stmt = $pdo->prepare("SELECT is_registered FROM products WHERE product_id = ?");
$stmt->execute([$product_id]);
$product = $stmt->fetch();

if (!$product) {
    jsonResponse(false, "Invalid Product ID");
}

if ($product['is_registered']) {
    jsonResponse(false, "Product already registered");
}

/* Create user */
$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare("
    INSERT INTO users (product_id, full_name, email, phone, home_address, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
");

$stmt->execute([
    $product_id,
    $full_name,
    $email,
    $phone ?? null,
    $home_address ?? null,
    $hash
]);

/* Mark product as registered */
$pdo->prepare("UPDATE products SET is_registered = 1 WHERE product_id = ?")
    ->execute([$product_id]);

jsonResponse(true, "Product registered successfully");
