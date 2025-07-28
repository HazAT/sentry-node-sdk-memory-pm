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
    this.loadTestEvents = []; // Track multiple load test events
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

  async runSingleLoadTest(requests = 500, concurrency = 20, testNumber = 1) {
    const startTime = (Date.now() - this.startTime) / 1000;
    console.log(`\\n🔥 Load test ${testNumber}: ${requests} requests, ${concurrency} concurrent (at ${startTime.toFixed(1)}s)...`);
    
    this.loadTestEvents.push({
      type: 'start',
      time: startTime,
      testNumber: testNumber,
      requests: requests,
      concurrency: concurrency
    });
    
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
        const endTime = (Date.now() - this.startTime) / 1000;
        
        if (code === 0) {
          console.log(`✅ Load test ${testNumber} completed (${endTime.toFixed(1)}s)`);
          this.loadTestEvents.push({
            type: 'end',
            time: endTime,
            testNumber: testNumber
          });
          this.parseLoadTestResults(output, testNumber);
          resolve(output);
        } else {
          console.error(`❌ Load test ${testNumber} failed:`, errorOutput);
          this.loadTestEvents.push({
            type: 'end',
            time: endTime,
            testNumber: testNumber,
            failed: true
          });
          resolve(); // Don't reject, continue with next test
        }
      });
    });
  }

  async runMultipleLoadTests(durationSeconds = 60) {
    console.log(`\\n🎯 Running multiple load tests over ${durationSeconds} seconds...`);
    
    // Wait for server to be stable
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const endTime = Date.now() + (durationSeconds * 1000);
    let testNumber = 1;
    
    while (Date.now() < endTime) {
      const remainingTime = (endTime - Date.now()) / 1000;
      
      if (remainingTime < 10) break; // Don't start a test if less than 10s remaining
      
      await this.runSingleLoadTest(300, 15, testNumber);
      testNumber++;
      
      // Wait between tests (3-8 seconds)
      const waitTime = 3000 + Math.random() * 5000;
      console.log(`⏳ Waiting ${(waitTime/1000).toFixed(1)}s before next test...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    console.log(`\\n🏁 Completed ${testNumber - 1} load tests over ${durationSeconds}s`);
  }

  parseLoadTestResults(output, testNumber) {
    const requestsPerSec = output.match(/Requests per second:\\s+([\\d.]+)/);
    const timePerRequest = output.match(/Time per request:\\s+([\\d.]+).*\\(mean\\)/);
    const completedRequests = output.match(/Complete requests:\\s+(\\d+)/);
    const failedRequests = output.match(/Failed requests:\\s+(\\d+)/);
    
    console.log(`📊 Test ${testNumber} Results:`);
    if (requestsPerSec) console.log(`   📈 Requests/sec: ${requestsPerSec[1]}`);
    if (timePerRequest) console.log(`   ⏱️  Time/request: ${timePerRequest[1]}ms`);
    if (completedRequests) console.log(`   ✅ Completed: ${completedRequests[1]}`);
    if (failedRequests) console.log(`   ❌ Failed: ${failedRequests[1]}`);
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

    // Create marker data for load test end events only
    const maxValue = Math.max(...memoryData, ...cpuData);
    const limitedLabels = labels.slice(0, 50);

    const loadTestEndData = limitedLabels.map((label) => {
      const time = parseFloat(label);
      const endEvent = this.loadTestEvents.find(event => 
        event.type === 'end' && Math.abs(time - event.time) < 0.5
      );
      return endEvent ? maxValue : null;
    });

    // Chart configuration with load test end markers only
    const datasets = [
      {
        label: 'Memory (MB)',
        data: memoryData.slice(0, 50),
        borderColor: '#36A2EB',
        backgroundColor: 'rgba(54,162,235,0.1)',
        fill: true,
        tension: 0.1
      },
      {
        label: 'CPU (%)',
        data: cpuData.slice(0, 50),
        borderColor: '#FF6384',
        backgroundColor: 'rgba(255,99,132,0.1)',
        fill: false,
        tension: 0.1
      }
    ];

    // Add load test end markers if we have events
    if (this.loadTestEvents.some(e => e.type === 'end')) {
      datasets.push({
        label: 'Load Test Complete',
        data: loadTestEndData,
        borderColor: '#28A745',
        backgroundColor: '#28A745',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#28A745',
        showLine: false,
        fill: false
      });
    }

    const chartConfig = {
      type: 'line',
      data: {
        labels: labels.slice(0, 50),
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Sentry SDK v9.42.0 - ${this.loadTestEvents.filter(e => e.type === 'start').length} Load Tests`
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: { 
            title: { display: true, text: 'Time (seconds)' },
            grid: { display: true }
          },
          y: { 
            title: { display: true, text: 'Usage (MB / %)' }, 
            beginAtZero: true,
            grid: { display: true }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
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
      duration = 90000, // Extended for multiple load tests
      loadTestDuration = 60, // Duration of load testing phase in seconds
      filename = `sentry-benchmark-${Date.now()}.png`
    } = options;

    console.log(`🎯 Starting extended benchmark:`);
    console.log(`⏱️  Total duration: ${duration/1000}s`);
    console.log(`🔥 Load testing phase: ${loadTestDuration}s with multiple runs`);
    console.log(`📊 Chart: ${filename}`);

    try {
      // Start monitoring
      await this.startMonitoring(duration);

      // Run multiple load tests concurrently with monitoring
      const loadTestPromise = this.runMultipleLoadTests(loadTestDuration);

      // Wait for monitoring to complete
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.monitorInterval) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500);
      });

      // Ensure load tests complete
      await loadTestPromise;

      // Generate chart with timeout protection
      console.log('\\n📊 Generating performance chart...');
      try {
        await this.generateChart(filename);
        console.log('\\n🎉 Extended benchmark completed successfully!');
        this.printLoadTestSummary();
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

  printLoadTestSummary() {
    const startEvents = this.loadTestEvents.filter(e => e.type === 'start');
    const endEvents = this.loadTestEvents.filter(e => e.type === 'end');
    const failedTests = endEvents.filter(e => e.failed).length;
    
    console.log('\\n📋 Load Test Summary:');
    console.log(`🔥 Total tests run: ${startEvents.length}`);
    console.log(`✅ Successful tests: ${endEvents.length - failedTests}`);
    if (failedTests > 0) console.log(`❌ Failed tests: ${failedTests}`);
    
    if (startEvents.length > 0) {
      const firstStart = Math.min(...startEvents.map(e => e.time));
      const lastEnd = Math.max(...endEvents.map(e => e.time));
      console.log(`⏱️  Load testing span: ${firstStart.toFixed(1)}s - ${lastEnd.toFixed(1)}s`);
    }
  }
}

// CLI usage
if (require.main === module) {
  const totalDuration = process.argv[2] ? parseInt(process.argv[2]) * 1000 : 90000;
  const loadTestDuration = process.argv[3] ? parseInt(process.argv[3]) : 60;
  const filename = process.argv[4] || `sentry-multi-benchmark-${Date.now()}.png`;

  const benchmark = new ReliableBenchmark();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Benchmark interrupted, cleaning up...');
    benchmark.stopMonitoring();
    process.exit(0);
  });

  benchmark.runFullBenchmark({
    duration: totalDuration,
    loadTestDuration,
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