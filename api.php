<?php
declare(strict_types=1);
/* ============================================================
   Ember Pact — backend API. Bearer token. JSON in/out.
   Two layers:
   - pact_state : per-user private blob (workouts/weight/schedule)   putstate/getstate
   - pact_days  : shared daily ledger both users read; each writes own  days/putday
   - pact_settlements : monthly settle log                              settle/settlements
   - upload : store a base64 image as a file, return URL
   ============================================================ */
$cfg = require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $cfg['cors_origin']);
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function fail(int $c, string $m): void { http_response_code($c); echo json_encode(['ok' => false, 'error' => $m]); exit; }
function ok($d = []): void { echo json_encode(['ok' => true] + (is_array($d) ? $d : ['data' => $d])); exit; }

// --- auth ---
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!$auth && function_exists('apache_request_headers')) {
  $h = apache_request_headers();
  $auth = $h['Authorization'] ?? $h['authorization'] ?? '';
}
if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m) || !hash_equals($cfg['token'], trim($m[1]))) fail(401, 'unauthorized');

// --- db ---
try {
  $dsn = "mysql:host={$cfg['db']['host']};dbname={$cfg['db']['name']};charset={$cfg['db']['charset']}";
  $pdo = new PDO($dsn, $cfg['db']['user'], $cfg['db']['pass'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
} catch (Throwable $e) { fail(500, 'db_connect_failed'); }

ensureTables($pdo);

function userId(): string { $u = (string)($_GET['user'] ?? ($_POST['user'] ?? 'me')); return $u === 'gf' ? 'gf' : 'me'; }
function bodyUser(array $b): string { $u = (string)($b['user'] ?? ($_GET['user'] ?? 'me')); return $u === 'gf' ? 'gf' : 'me'; }
function body(): array { $r = file_get_contents('php://input'); $j = json_decode($r ?: '', true); return is_array($j) ? $j : []; }

$action = $_GET['action'] ?? '';
switch ("{$_SERVER['REQUEST_METHOD']}:$action") {
  case 'GET:ping':        ok(['ts' => time(), 'app' => 'ember-pact']); break;
  case 'POST:putstate':   putState($pdo); break;
  case 'GET:getstate':    getState($pdo); break;
  case 'GET:days':        getDays($pdo); break;
  case 'POST:putday':     putDay($pdo); break;
  case 'POST:settle':     settle($pdo); break;
  case 'GET:settlements': settlements($pdo); break;
  case 'POST:upload':     upload(); break;
  default: fail(404, 'unknown_action');
}

// --- schema (idempotent; mirrors db/pact_schema.sql) ---
function ensureTables(PDO $p): void {
  $p->exec("CREATE TABLE IF NOT EXISTS pact_state (
    user VARCHAR(16) NOT NULL, data LONGTEXT NOT NULL, updated_at BIGINT NOT NULL,
    PRIMARY KEY (user)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $p->exec("CREATE TABLE IF NOT EXISTS pact_days (
    user VARCHAR(16) NOT NULL, date CHAR(10) NOT NULL,
    is_workout_day TINYINT(1) NOT NULL DEFAULT 0, swap_used TINYINT(1) NOT NULL DEFAULT 0,
    step_count INT NOT NULL DEFAULT 0, step_photo_url VARCHAR(255) DEFAULT NULL,
    workout_done TINYINT(1) NOT NULL DEFAULT 0, workout_photo_url VARCHAR(255) DEFAULT NULL,
    complete TINYINT(1) NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL,
    PRIMARY KEY (user, date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $p->exec("CREATE TABLE IF NOT EXISTS pact_settlements (
    id INT NOT NULL AUTO_INCREMENT, month CHAR(7) NOT NULL, net_to_me INT NOT NULL,
    note VARCHAR(255) DEFAULT NULL, created_at BIGINT NOT NULL,
    PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// --- per-user private blob ---
function putState(PDO $p): void {
  $raw = file_get_contents('php://input'); if (!$raw) fail(400, 'empty_body');
  if (strlen($raw) > 8 * 1024 * 1024) fail(413, 'too_large');
  if (!is_array(json_decode($raw, true))) fail(400, 'bad_json');
  $ts = (int) round(microtime(true) * 1000);
  $p->prepare("INSERT INTO pact_state(user,data,updated_at) VALUES(:u,:d,:t)
    ON DUPLICATE KEY UPDATE data=VALUES(data),updated_at=VALUES(updated_at)")
   ->execute([':u' => userId(), ':d' => $raw, ':t' => $ts]);
  ok(['bytes' => strlen($raw), 'updated_at' => $ts]);
}
function getState(PDO $p): void {
  $s = $p->prepare("SELECT data,updated_at FROM pact_state WHERE user=:u"); $s->execute([':u' => userId()]);
  $r = $s->fetch(); if (!$r) ok(['state' => null, 'updated_at' => null]);
  echo json_encode(['ok' => true, 'updated_at' => (int)$r['updated_at'], 'state' => json_decode($r['data'], true)]); exit;
}

// complete = walk_ok AND (NOT workout_day OR swap OR workout_done)
function computeComplete(array $d): int {
  $need = !empty($d['swap_used']) ? 14000 : 7000;
  $walkOk = ((int)($d['step_count'] ?? 0)) >= $need;
  $sessionOk = empty($d['is_workout_day']) || !empty($d['swap_used']) || !empty($d['workout_done']);
  return ($walkOk && $sessionOk) ? 1 : 0;
}
function getDays(PDO $p): void {
  $month = $_GET['month'] ?? null;
  if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
    $s = $p->prepare("SELECT * FROM pact_days WHERE date LIKE :m ORDER BY date,user"); $s->execute([':m' => $month . '-%']);
  } else { $s = $p->query("SELECT * FROM pact_days ORDER BY date,user"); }
  ok(['days' => $s->fetchAll()]);
}
function putDay(PDO $p): void {
  $b = body(); $u = bodyUser($b);
  $date = (string)($b['date'] ?? ''); if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail(400, 'bad_date');
  // partial update: load existing row, apply only the fields present in the body.
  $sel = $p->prepare("SELECT * FROM pact_days WHERE user=:u AND date=:d"); $sel->execute([':u' => $u, ':d' => $date]);
  $row = $sel->fetch() ?: ['is_workout_day' => 0, 'swap_used' => 0, 'step_count' => 0, 'step_photo_url' => null, 'workout_done' => 0, 'workout_photo_url' => null];
  $bool = fn($k) => array_key_exists($k, $b) ? (!empty($b[$k]) ? 1 : 0) : (int)$row[$k];
  $str  = fn($k) => array_key_exists($k, $b) ? (isset($b[$k]) && $b[$k] !== null ? substr((string)$b[$k], 0, 255) : null) : $row[$k];
  $d = [
    'is_workout_day'    => $bool('is_workout_day'),
    'swap_used'         => $bool('swap_used'),
    'step_count'        => array_key_exists('step_count', $b) ? (int)$b['step_count'] : (int)$row['step_count'],
    'step_photo_url'    => $str('step_photo_url'),
    'workout_done'      => $bool('workout_done'),
    'workout_photo_url' => $str('workout_photo_url'),
  ];
  $complete = computeComplete($d); $ts = (int) round(microtime(true) * 1000);
  $p->prepare("INSERT INTO pact_days(user,date,is_workout_day,swap_used,step_count,step_photo_url,workout_done,workout_photo_url,complete,updated_at)
    VALUES(:u,:date,:iwd,:swap,:sc,:sp,:wd,:wp,:c,:t)
    ON DUPLICATE KEY UPDATE is_workout_day=VALUES(is_workout_day),swap_used=VALUES(swap_used),step_count=VALUES(step_count),
      step_photo_url=VALUES(step_photo_url),workout_done=VALUES(workout_done),workout_photo_url=VALUES(workout_photo_url),
      complete=VALUES(complete),updated_at=VALUES(updated_at)")
   ->execute([':u' => $u, ':date' => $date, ':iwd' => $d['is_workout_day'], ':swap' => $d['swap_used'], ':sc' => $d['step_count'],
     ':sp' => $d['step_photo_url'], ':wd' => $d['workout_done'], ':wp' => $d['workout_photo_url'], ':c' => $complete, ':t' => $ts]);
  ok(['day' => ['user' => $u, 'date' => $date, 'complete' => $complete] + $d + ['updated_at' => $ts]]);
}
function settle(PDO $p): void {
  $b = body(); $month = (string)($b['month'] ?? ''); if (!preg_match('/^\d{4}-\d{2}$/', $month)) fail(400, 'bad_month');
  $p->prepare("INSERT INTO pact_settlements(month,net_to_me,note,created_at) VALUES(:m,:n,:note,:t)")
   ->execute([':m' => $month, ':n' => (int)($b['net_to_me'] ?? 0), ':note' => substr((string)($b['note'] ?? ''), 0, 255), ':t' => (int) round(microtime(true) * 1000)]);
  ok(['id' => (int)$p->lastInsertId()]);
}
function settlements(PDO $p): void {
  ok(['settlements' => $p->query("SELECT * FROM pact_settlements ORDER BY month DESC")->fetchAll()]);
}

// --- image upload ---
function upload(): void {
  $b = body(); if (empty($b['data'])) fail(400, 'bad_json');
  if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b['data'], $m)) fail(400, 'bad_image');
  $map = ['jpeg' => 'jpg', 'jpg' => 'jpg', 'png' => 'png', 'webp' => 'webp'];
  $ext = $map[strtolower($m[1])] ?? null; if (!$ext) fail(415, 'unsupported');
  $bin = base64_decode(substr($b['data'], strpos($b['data'], ',') + 1), true); if ($bin === false) fail(400, 'bad_base64');
  if (strlen($bin) > 4 * 1024 * 1024) fail(413, 'image_too_large');
  $dir = __DIR__ . '/uploads'; if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) fail(500, 'mkdir_failed');
  $name = 'p_' . bin2hex(random_bytes(8)) . '.' . $ext;
  if (file_put_contents("$dir/$name", $bin) === false) fail(500, 'write_failed');
  $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
  ok(['url' => $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base . '/uploads/' . $name]);
}
