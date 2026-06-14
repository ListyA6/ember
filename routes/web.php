<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Http\Request;

// Serve the Ember PWA shell at the root. Static assets (js/, styles/,
// assets/, sw.js, manifest) are served directly from public/; only the
// document root needs an explicit route so it doesn't fall through to
// the framework.
Route::get('/', function () {
    return response(
        file_get_contents(public_path('index.html')),
        200,
        ['Content-Type' => 'text/html; charset=UTF-8']
    );
});

// Deploy bootstrap: run migrations without SSH. Key-gated.
// NOTE: this app uses SESSION_DRIVER=file (set in .env), so the first-run
// chicken-and-egg of the database session driver — StartSession querying a
// not-yet-created `sessions` table — never occurs. No middleware surgery needed.
Route::get('/setup', function (Request $request) {
    abort_unless($request->query('key') === env('SETUP_KEY'), 403);
    Artisan::call('migrate', ['--force' => true]);
    return response('<pre>'.e(Artisan::output()).'</pre>');
});
