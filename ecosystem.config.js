module.exports = {
    apps: [
        {
            name: 'sv-realtime',
            script: './app.js',
            watch: true,
            instances: '1',
            exec_mode: 'fork',
            env_localhost: {
                PORT: 443,
                NODE_ENV: 'localhost',
            },
            env_production: {
                PORT: 443,
                NODE_ENV: 'production',
            },
        },
        {
            name: 'sv-realtime',
            script: './app.js',
            watch: true,
            instances: '1',
            exec_mode: 'fork',
            env_localhost: {
                PORT: 443,
                NODE_ENV: 'localhost',
            },
            env_production: {
                PORT: 443,
                NODE_ENV: 'production',
            },
        },
    ],
};
