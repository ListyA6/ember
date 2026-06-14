<?php

namespace Tests\Feature;

use Tests\TestCase;

class PwaShellTest extends TestCase
{
    public function test_root_serves_the_ember_pwa(): void
    {
        $res = $this->get('/');
        $res->assertStatus(200);
        // The PWA's index.html carries the wordmark and the store script.
        $res->assertSee('ember', false);
        $res->assertSee('js/store.js', false);
    }
}
