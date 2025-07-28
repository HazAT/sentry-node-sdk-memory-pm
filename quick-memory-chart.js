const { spawn } = require('child_process');
const pidusage = require('pidusage');
const axios = require('axios');
const fs = require('fs');

async function createMemoryChart() {
  console.log('🚀 Starting memory monitoring and chart generation...');
  
  const dataPoints = [];
  const startTime = Date.now();
  
  // Start Express server
  const server = spawn('node', ['express.js'], { stdio: 'pipe' });
  
  console.log('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Collect data for 20 seconds
  const duration = 20;
  console.log(`Collecting data for ${duration} seconds...`);
  
  for (let i = 0; i < duration; i++) {
    try {
      const stats = await pidusage(server.pid);
      const memory = Math.round(stats.memory / 1024 / 1024);
      const cpu = Math.round(stats.cpu * 100) / 100;
      
      dataPoints.push({
        time: i + 1,
        memory: memory,
        cpu: cpu
      });
      
      console.log(`[${i + 1}s] Memory: ${memory}MB | CPU: ${cpu}%`);
      
      if (i < duration - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('Process monitoring ended');
      break;
    }
  }
  
  server.kill();
  console.log('\\n📊 Data collection completed, generating chart...');
  
  if (dataPoints.length === 0) {
    throw new Error('No data collected');
  }
  
  // Create dual-axis chart configuration
  const labels = dataPoints.map(p => `${p.time}s`);
  const memoryData = dataPoints.map(p => p.memory);
  const cpuData = dataPoints.map(p => p.cpu);
  
  const memoryMin = Math.min(...memoryData);
  const memoryMax = Math.max(...memoryData);
  const memoryAvg = Math.round(memoryData.reduce((a, b) => a + b, 0) / memoryData.length);
  
  const cpuMin = Math.min(...cpuData).toFixed(1);
  const cpuMax = Math.max(...cpuData).toFixed(1);
  const cpuAvg = (cpuData.reduce((a, b) => a + b, 0) / cpuData.length).toFixed(1);
  
  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Memory Usage (MB)',
          data: memoryData,
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          fill: true,
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'CPU Usage (%)',
          data: cpuData,
          borderColor: '#FF6384',
          backgroundColor: 'rgba(255, 99, 132, 0.1)',
          fill: false,
          tension: 0.1,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: 'Sentry Node SDK v9.42.0 - Memory & CPU Usage',
          font: { size: 16 }
        },
        subtitle: {
          display: true,
          text: `Memory: ${memoryMin}-${memoryMax}MB (avg: ${memoryAvg}MB) | CPU: ${cpuMin}-${cpuMax}% (avg: ${cpuAvg}%) | ${dataPoints.length} samples`
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
          beginAtZero: false,
          title: {
            display: true,
            text: 'Memory (MB)',
            color: '#36A2EB'
          },
          ticks: {
            color: '#36A2EB'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'CPU Usage (%)',
            color: '#FF6384'
          },
          ticks: {
            color: '#FF6384'
          },
          grid: {
            drawOnChartArea: false,
          }
        }
      }
    }
  };
  
  // Generate QuickChart URL
  const baseUrl = 'https://quickchart.io/chart';
  const params = new URLSearchParams({
    c: JSON.stringify(chartConfig),
    w: '1000',
    h: '500',
    f: 'png',
    bkg: 'white'
  });
  
  const chartUrl = `${baseUrl}?${params}`;
  console.log('Generated chart URL');
  
  // Download chart
  try {
    console.log('Downloading chart image...');
    const response = await axios({
      method: 'get',
      url: chartUrl,
      responseType: 'stream',
      timeout: 15000
    });
    
    const filename = `sentry-v9-memory-${Date.now()}.png`;
    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Chart saved as ${filename}`);
        console.log('\\n📈 Performance Summary:');
        console.log(`Memory Usage: ${memoryMin}MB - ${memoryMax}MB (avg: ${memoryAvg}MB)`);
        console.log(`CPU Usage: ${cpuMin}% - ${cpuMax}% (avg: ${cpuAvg}%)`);
        console.log(`Duration: ${duration}s | Samples: ${dataPoints.length}`);
        resolve(filename);
      });
      writer.on('error', reject);
    });
    
  } catch (error) {
    console.error('❌ Error downloading chart:', error.message);
    throw error;
  }
}

// Run the chart generator
createMemoryChart().then((filename) => {
  console.log(`\\n🎉 Memory chart generated successfully: ${filename}`);
  process.exit(0);
}).catch((error) => {
  console.error('❌ Chart generation failed:', error.message);
  process.exit(1);
});