const { spawn } = require('child_process');
const pidusage = require('pidusage');
const QuickChart = require('quickchart-js');
const fs = require('fs');
const axios = require('axios');

class MemoryChartGenerator {
  constructor() {
    this.dataPoints = [];
    this.startTime = Date.now();
    this.server = null;
    this.monitorInterval = null;
  }

  async startMonitoring(duration = 60000) {
    console.log('Starting Express server and memory monitoring...');
    
    // Start the Express server
    this.server = spawn('node', ['express.js'], {
      stdio: 'pipe'
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        const stats = await pidusage(this.server.pid);
        const timestamp = new Date();
        
        this.dataPoints.push({
          time: timestamp.toISOString(),
          memory: Math.round(stats.memory / 1024 / 1024), // MB
          cpu: Math.round(stats.cpu * 100) / 100
        });
        
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`[${elapsed}s] Memory: ${Math.round(stats.memory / 1024 / 1024)}MB | CPU: ${stats.cpu.toFixed(1)}%`);
        
      } catch (error) {
        console.log('Monitoring ended or error:', error.message);
        clearInterval(this.monitorInterval);
      }
    }, 1000);

    // Stop monitoring after duration
    setTimeout(() => {
      this.stopMonitoring();
    }, duration);
  }

  stopMonitoring() {
    console.log('\\nStopping monitoring and generating chart...');
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    
    if (this.server) {
      this.server.kill();
    }
  }

  async generateChart(filename = 'memory-usage-chart.png') {
    if (this.dataPoints.length === 0) {
      console.log('No data points collected');
      return;
    }

    // Prepare data for Chart.js format
    const labels = this.dataPoints.map(point => {
      const date = new Date(point.time);
      return date.toLocaleTimeString();
    });

    const memoryData = this.dataPoints.map(point => point.memory);
    const cpuData = this.dataPoints.map(point => point.cpu);

    // Create chart configuration
    const chartConfig = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Memory Usage (MB)',
            data: memoryData,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            yAxisID: 'y'
          },
          {
            label: 'CPU Usage (%)',
            data: cpuData,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Sentry Node SDK v9.42.0 - Memory & CPU Usage (${this.dataPoints.length} samples)`
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Memory (MB)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'CPU (%)'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        }
      }
    };

    try {
      console.log('Generating chart...');
      
      const chart = new QuickChart();
      chart
        .setConfig(chartConfig)
        .setWidth(1200)
        .setHeight(600)
        .setBackgroundColor('white');

      // Get chart URL
      const chartUrl = chart.getUrl();
      console.log('Chart URL:', chartUrl);

      // Download the image
      console.log(`Downloading chart as ${filename}...`);
      const response = await axios({
        method: 'get',
        url: chartUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(filename);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Chart saved as ${filename}`);
          this.printSummary();
          resolve(filename);
        });
        writer.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating chart:', error.message);
      throw error;
    }
  }

  printSummary() {
    if (this.dataPoints.length === 0) return;

    const memoryValues = this.dataPoints.map(p => p.memory);
    const cpuValues = this.dataPoints.map(p => p.cpu);

    const memoryStats = {
      min: Math.min(...memoryValues),
      max: Math.max(...memoryValues),
      avg: Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length)
    };

    const cpuStats = {
      min: Math.min(...cpuValues).toFixed(1),
      max: Math.max(...cpuValues).toFixed(1),
      avg: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1)
    };

    console.log('\\n📊 Performance Summary:');
    console.log(`Memory Usage: ${memoryStats.min}MB - ${memoryStats.max}MB (avg: ${memoryStats.avg}MB)`);
    console.log(`CPU Usage: ${cpuStats.min}% - ${cpuStats.max}% (avg: ${cpuStats.avg}%)`);
    console.log(`Duration: ${((Date.now() - this.startTime) / 1000).toFixed(1)}s`);
    console.log(`Samples: ${this.dataPoints.length}`);
  }

  async runBenchmark(duration = 30000) {
    await this.startMonitoring(duration);
    
    // Wait for monitoring to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.monitorInterval) {
          clearInterval(checkInterval);
          setTimeout(() => {
            this.generateChart().then(resolve).catch(resolve);
          }, 1000);
        }
      }, 500);
    });
  }
}

// CLI usage
if (require.main === module) {
  const duration = process.argv[2] ? parseInt(process.argv[2]) * 1000 : 30000;
  const filename = process.argv[3] || `memory-chart-${Date.now()}.png`;
  
  console.log(`Running ${duration/1000}s benchmark...`);
  
  const generator = new MemoryChartGenerator();
  generator.runBenchmark(duration).then(() => {
    console.log('Benchmark complete!');
    process.exit(0);
  }).catch((error) => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

module.exports = MemoryChartGenerator;