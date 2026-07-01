<?php
// Copy to config.php and fill in. config.php is gitignored (never commit secrets).
// On Hostinger: reuse the live Ember DB creds (host/user/pass) but point `name`
// at u841253279_fit — the pact_ tables live there. `token` must match the value
// baked into js/pact-sync.js.
return [
  'token'       => 'CHANGE_ME_LONG_RANDOM_HEX',
  'cors_origin' => '*',
  'db' => [
    'host'    => '127.0.0.1',
    'name'    => 'ember_pact',
    'user'    => 'root',
    'pass'    => '',
    'charset' => 'utf8mb4',
  ],
];
