const { spawn } = require('child_process');
const pidusage = require('pidusage');
const QuickChart = require('quickchart-js');
const fs = require('fs');
const axios = require('axios');

class SimpleChartGenerator {
  constructor() {
    this.dataPoints = [];
    this.startTime = Date.now();
  }

  async collectData(durationSeconds = 30) {
    console.log(`Starting ${durationSeconds}s data collection...`);
    
    // Start the Express server
    const server = spawn('node', ['express.js'], { stdio: 'pipe' });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Collect data points
    const interval = setInterval(async () => {
      try {
        const stats = await pidusage(server.pid);
        const elapsed = (Date.now() - this.startTime) / 1000;
        
        this.dataPoints.push({
          time: elapsed.toFixed(1),
          memory: Math.round(stats.memory / 1024 / 1024),
          cpu: Math.round(stats.cpu * 100) / 100
        });
        
        console.log(`[${elapsed.toFixed(1)}s] Memory: ${Math.round(stats.memory / 1024 / 1024)}MB | CPU: ${stats.cpu.toFixed(1)}%`);
        
      } catch (error) {
        console.log('Data collection ended');
        clearInterval(interval);
      }
    }, 1000);
    
    // Stop after duration
    setTimeout(() => {
      clearInterval(interval);
      server.kill();
      console.log('\\nData collection completed');
    }, durationSeconds * 1000);
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, (durationSeconds + 2) * 1000));
  }

  async generateChart(filename = 'memory-chart.png') {
    if (this.dataPoints.length === 0) {
      throw new Error('No data points collected');
    }

    const labels = this.dataPoints.map(p => `${p.time}s`);
    const memoryData = this.dataPoints.map(p => p.memory);
    const cpuData = this.dataPoints.map(p => p.cpu);

    // Calculate statistics
    const memoryStats = {
      min: Math.min(...memoryData),
      max: Math.max(...memoryData),
      avg: Math.round(memoryData.reduce((a, b) => a + b, 0) / memoryData.length)
    };

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
            yAxisID: 'y',
            tension: 0.1
          },
          {
            label: 'CPU Usage (%)',
            data: cpuData,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            yAxisID: 'y1',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Sentry Node SDK v9.42.0 Performance (${this.dataPoints.length} samples)`,
            font: { size: 16 }
          },
          subtitle: {
            display: true,
            text: `Memory: ${memoryStats.min}-${memoryStats.max}MB (avg: ${memoryStats.avg}MB)`,
            font: { size: 12 }
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
              text: 'Time (seconds)'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Memory (MB)',
              color: 'rgb(54, 162, 235)'
            },
            ticks: {
              color: 'rgb(54, 162, 235)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'CPU (%)',
              color: 'rgb(255, 99, 132)'
            },
            ticks: {
              color: 'rgb(255, 99, 132)'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        }
      }
    };

    console.log('Generating chart...');
    
    const chart = new QuickChart();
    chart
      .setConfig(chartConfig)
      .setWidth(1200)
      .setHeight(600)
      .setBackgroundColor('white');

    const chartUrl = chart.getUrl();
    console.log('Chart URL generated');

    // Download chart
    const response = await axios({
      method: 'get',
      url: chartUrl,
      responseType: 'stream',
      timeout: 15000
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
  }

  printSummary() {
    const memoryValues = this.dataPoints.map(p => p.memory);
    const cpuValues = this.dataPoints.map(p => p.cpu);

    console.log('\\n📊 Performance Summary:');
    console.log(`Memory: ${Math.min(...memoryValues)}-${Math.max(...memoryValues)}MB (avg: ${Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length)}MB)`);
    console.log(`CPU: ${Math.min(...cpuValues).toFixed(1)}-${Math.max(...cpuValues).toFixed(1)}% (avg: ${(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1)}%)`);
    console.log(`Duration: ${this.dataPoints.length}s | Samples: ${this.dataPoints.length}`);
  }

  async run(durationSeconds = 30, filename) {
    try {
      await this.collectData(durationSeconds);
      const chartFile = filename || `sentry-v9-${Date.now()}.png`;
      await this.generateChart(chartFile);
      return chartFile;
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const duration = process.argv[2] ? parseInt(process.argv[2]) : 30;
  const filename = process.argv[3];
  
  const generator = new SimpleChartGenerator();
  generator.run(duration, filename).then((file) => {
    console.log(`\\n🎉 Chart generation completed: ${file}`);
    process.exit(0);
  }).catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
}

module.exports = SimpleChartGenerator;