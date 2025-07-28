const { spawn } = require('child_process');
const pidusage = require('pidusage');

console.log('Starting Express server with memory monitoring...');

// Start the Express server
const server = spawn('node', ['express.js'], {
  stdio: 'inherit'
});

let startTime = Date.now();

// Monitor memory usage
const monitorInterval = setInterval(async () => {
  try {
    const stats = await pidusage(server.pid);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`[${elapsed}s] Memory: ${(stats.memory / 1024 / 1024).toFixed(1)}MB | CPU: ${stats.cpu.toFixed(1)}%`);
  } catch (error) {
    console.log('Process ended or monitoring error:', error.message);
    clearInterval(monitorInterval);
  }
}, 1000);

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\nStopping server and memory monitoring...');
  clearInterval(monitorInterval);
  server.kill();
  process.exit(0);
});

server.on('exit', (code) => {
  console.log(`\nServer process exited with code ${code}`);
  clearInterval(monitorInterval);
  process.exit(code);
});