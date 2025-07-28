const { spawn } = require('child_process');
const pidusage = require('pidusage');
const axios = require('axios');
const fs = require('fs');

class ReliableBenchmark {
  constructor() {
    this.dataPoints = [];
    this.startTime = Date.now();
    this.server = null;
    this.monitorInterval = null;
  }

  async startMonitoring(durationMs = 45000) {
    console.log('🚀 Starting Express server and monitoring...');
    
    // Start the Express server
    this.server = spawn('node', ['express.js'], {
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Server started, beginning monitoring...');

    // Start monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        const stats = await pidusage(this.server.pid);
        const timestamp = new Date();
        
        this.dataPoints.push({
          time: (Date.now() - this.startTime) / 1000,
          memory: Math.round(stats.memory / 1024 / 1024),
          cpu: Math.round(stats.cpu * 100) / 100
        });
        
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`[${elapsed}s] Memory: ${Math.round(stats.memory / 1024 / 1024)}MB | CPU: ${stats.cpu.toFixed(1)}%`);
        
      } catch (error) {
        console.log('⚠️  Process monitoring ended:', error.message);
        this.stopMonitoring();
      }
    }, 1000);

    // Auto-stop after duration
    setTimeout(() => {
      this.stopMonitoring();
    }, durationMs);
  }

  stopMonitoring() {
    console.log('\\n🛑 Stopping monitoring...');
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }

  async runLoadTest(requests = 1000, concurrency = 20) {
    console.log(`\\n🔥 Starting load test: ${requests} requests, ${concurrency} concurrent...`);
    
    // Wait for server to be stable
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return new Promise((resolve, reject) => {
      const ab = spawn('ab', [
        '-c', concurrency.toString(),
        '-n', requests.toString(),
        'http://localhost:3000/'
      ], { stdio: 'pipe' });
      
      let output = '';
      let errorOutput = '';
      
      ab.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      ab.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      ab.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Load test completed successfully');
          this.parseLoadTestResults(output);
          resolve(output);
        } else {
          console.error('❌ Load test failed:', errorOutput);
          resolve(); // Don't reject, continue with chart generation
        }
      });
    });
  }

  parseLoadTestResults(output) {
    console.log('\\n📈 Load Test Results:');
    
    const requestsPerSec = output.match(/Requests per second:\\s+([\\d.]+)/);
    const timePerRequest = output.match(/Time per request:\\s+([\\d.]+).*\\(mean\\)/);
    const completedRequests = output.match(/Complete requests:\\s+(\\d+)/);
    const failedRequests = output.match(/Failed requests:\\s+(\\d+)/);
    
    if (requestsPerSec) console.log(`📊 Requests/sec: ${requestsPerSec[1]}`);
    if (timePerRequest) console.log(`⏱️  Time/request: ${timePerRequest[1]}ms`);
    if (completedRequests) console.log(`✅ Completed: ${completedRequests[1]}`);
    if (failedRequests) console.log(`❌ Failed: ${failedRequests[1]}`);
  }

  async generateChart(filename) {
    if (this.dataPoints.length === 0) {
      console.log('⚠️  No data points collected, skipping chart generation');
      return;
    }

    console.log(`\\n📊 Generating chart with ${this.dataPoints.length} data points...`);

    // Prepare data
    const labels = this.dataPoints.map(p => p.time.toFixed(1));
    const memoryData = this.dataPoints.map(p => p.memory);
    const cpuData = this.dataPoints.map(p => p.cpu);

    // Calculate statistics
    const memoryStats = {
      min: Math.min(...memoryData),
      max: Math.max(...memoryData),
      avg: Math.round(memoryData.reduce((a, b) => a + b, 0) / memoryData.length)
    };

    const cpuStats = {
      min: Math.min(...cpuData).toFixed(1),
      max: Math.max(...cpuData).toFixed(1),
      avg: (cpuData.reduce((a, b) => a + b, 0) / cpuData.length).toFixed(1)
    };

    // Simple, reliable chart configuration
    const chartConfig = {
      type: 'line',
      data: {
        labels: labels.slice(0, 50), // Limit to 50 points for reliability
        datasets: [
          {
            label: 'Memory (MB)',
            data: memoryData.slice(0, 50),
            borderColor: '#36A2EB',
            backgroundColor: 'rgba(54,162,235,0.1)',
            fill: true
          },
          {
            label: 'CPU (%)',
            data: cpuData.slice(0, 50),
            borderColor: '#FF6384',
            backgroundColor: 'rgba(255,99,132,0.1)',
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Sentry SDK v9.42.0 Benchmark Results'
          }
        },
        scales: {
          x: { title: { display: true, text: 'Time (s)' } },
          y: { title: { display: true, text: 'Usage' }, beginAtZero: true }
        }
      }
    };

    try {
      console.log('🌐 Generating chart via QuickChart...');
      
      const chartJson = JSON.stringify(chartConfig);
      const chartUrl = `https://quickchart.io/chart?w=1000&h=500&f=png&bkg=white&c=${encodeURIComponent(chartJson)}`;
      
      console.log('📥 Downloading chart...');
      const response = await axios({
        method: 'get',
        url: chartUrl,
        responseType: 'stream',
        timeout: 15000
      });

      const writer = fs.createWriteStream(filename);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          writer.destroy();
          reject(new Error('Chart download timeout'));
        }, 20000);

        writer.on('finish', () => {
          clearTimeout(timeout);
          console.log(`✅ Chart saved as ${filename}`);
          this.printSummary(memoryStats, cpuStats);
          resolve(filename);
        });

        writer.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ Chart save failed:', error.message);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ Chart generation failed:', error.message);
      console.log('📝 Printing summary without chart...');
      this.printSummary(memoryStats, cpuStats);
      throw error;
    }
  }

  printSummary(memoryStats, cpuStats) {
    console.log('\\n📋 Benchmark Summary:');
    console.log(`🧠 Memory: ${memoryStats.min}-${memoryStats.max}MB (avg: ${memoryStats.avg}MB)`);
    console.log(`🔥 CPU: ${cpuStats.min}-${cpuStats.max}% (avg: ${cpuStats.avg}%)`);
    console.log(`⏱️  Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`);
    console.log(`📊 Samples: ${this.dataPoints.length}`);
  }

  async runFullBenchmark(options = {}) {
    const {
      duration = 30000, // Shorter default for reliability
      requests = 1000,
      concurrency = 20,
      filename = `sentry-benchmark-${Date.now()}.png`
    } = options;

    console.log(`🎯 Starting benchmark:`);
    console.log(`⏱️  Duration: ${duration/1000}s`);
    console.log(`🔥 Load test: ${requests} requests, ${concurrency} concurrent`);
    console.log(`📊 Chart: ${filename}`);

    try {
      // Start monitoring
      await this.startMonitoring(duration);

      // Run load test concurrently
      const loadTestPromise = this.runLoadTest(requests, concurrency);

      // Wait for monitoring to complete
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.monitorInterval) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });

      // Ensure load test completes
      await loadTestPromise;

      // Generate chart with timeout protection
      console.log('\\n📊 Generating performance chart...');
      try {
        await this.generateChart(filename);
        console.log('\\n🎉 Benchmark completed successfully!');
        return filename;
      } catch (chartError) {
        console.log('\\n⚠️  Benchmark completed (chart generation failed)');
        return null;
      }

    } catch (error) {
      console.error('💥 Benchmark failed:', error.message);
      this.stopMonitoring();
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const duration = process.argv[2] ? parseInt(process.argv[2]) * 1000 : 30000;
  const requests = process.argv[3] ? parseInt(process.argv[3]) : 1000;
  const concurrency = process.argv[4] ? parseInt(process.argv[4]) : 20;
  const filename = process.argv[5] || `sentry-benchmark-${Date.now()}.png`;

  const benchmark = new ReliableBenchmark();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Benchmark interrupted, cleaning up...');
    benchmark.stopMonitoring();
    process.exit(0);
  });

  benchmark.runFullBenchmark({
    duration,
    requests,
    concurrency,
    filename
  }).then((result) => {
    if (result) {
      console.log(`📈 Chart saved: ${result}`);
    }
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Benchmark failed:', error.message);
    process.exit(1);
  });
}

module.exports = ReliableBenchmark;