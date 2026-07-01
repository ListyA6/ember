<?php
// /pact/ is retired. Proxy the API to the real backend at the site root so any
// lingering /pact/ install still saves instead of erroring on an HTML 404.
// Root api.php uses __DIR__ (the site root) for config.php + uploads/, so creds resolve correctly.
require __DIR__ . '/../api.php';
