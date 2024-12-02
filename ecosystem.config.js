module.exports = {
  apps: [{
    name: 'animus',
    script: './dist/startup.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    time: true,
    // Restart if memory usage is too high
    max_memory_restart: '1G',
    // Restart if app crashes
    exp_backoff_restart_delay: 100,
    // Restart on file changes
    watch: false,
    // Graceful shutdown
    kill_timeout: 5000,
    // Wait before force restarting
    wait_ready: true,
    // Restart delay
    restart_delay: 4000
  }]
}; 