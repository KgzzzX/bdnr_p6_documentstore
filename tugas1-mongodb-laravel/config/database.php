<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Database Connection Name
    |--------------------------------------------------------------------------
    | Sesuai Slide 16 & Pembahasan Bug 2: Biarkan default SQLite / MySQL
    | agar tidak terjadi error "tabel sessions tidak ditemukan".
    | Model Buku akan secara eksplisit menyebut koneksinya: $connection = 'mongodb';
    */
    'default' => env('DB_CONNECTION', 'sqlite'),

    'connections' => [

        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DATABASE_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
        ],

        /*
        |--------------------------------------------------------------------------
        | MongoDB Connection (mongodb/laravel-mongodb)
        |--------------------------------------------------------------------------
        */
        'mongodb' => [
            'driver' => 'mongodb',
            'dsn' => env('MONGODB_URI', 'mongodb://localhost:27017'),
            'database' => env('MONGODB_DATABASE', 'perpustakaan_db'),
            'options' => [
                'appname' => 'LaravelPerpustakaan'
            ],
        ],

    ],

];

