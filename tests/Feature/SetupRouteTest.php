<?php

namespace Tests\Feature;

use Tests\TestCase;

class SetupRouteTest extends TestCase
{
    private function setKey(string $key): void
    {
        // env() reads from $_ENV/$_SERVER first; set both so the route sees it.
        putenv("SETUP_KEY={$key}");
        $_ENV['SETUP_KEY'] = $key;
        $_SERVER['SETUP_KEY'] = $key;
    }

    public function test_setup_rejects_wrong_key(): void
    {
        $this->setKey('secret123');
        $this->get('/setup?key=wrong')->assertStatus(403);
    }

    public function test_setup_runs_migrations_with_right_key(): void
    {
        $this->setKey('secret123');
        $this->get('/setup?key=secret123')->assertStatus(200);
    }
}
