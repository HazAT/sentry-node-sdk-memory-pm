const { spawn } = require('child_process');
const pidusage = require('pidusage');
const axios = require('axios');
const fs = require('fs');

async function createMemoryCpuChart() {
  console.log('🚀 Starting memory & CPU monitoring...');
  
  const dataPoints = [];
  const startTime = Date.now();
  
  // Start Express server
  const server = spawn('node', ['express.js'], { stdio: 'pipe' });
  
  console.log('Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Collect data for 25 seconds
  const duration = 25;
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
  
  // Prepare data
  const labels = dataPoints.map(p => p.time);
  const memoryData = dataPoints.map(p => p.memory);
  const cpuData = dataPoints.map(p => p.cpu);
  
  // Calculate stats
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
  
  // Create simplified chart config for better compatibility
  const chartConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Memory (MB)',
          data: memoryData,
          borderColor: 'rgb(54,162,235)',
          backgroundColor: 'rgba(54,162,235,0.1)',
          fill: true,
          tension: 0.1
        },
        {
          label: 'CPU (%)',
          data: cpuData,
          borderColor: 'rgb(255,99,132)',
          backgroundColor: 'rgba(255,99,132,0.1)',
          fill: false,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Sentry Node SDK v9.42.0 - Performance Monitoring'
        },
        legend: {
          display: true
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time (seconds)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Usage'
          },
          beginAtZero: true
        }
      }
    }
  };
  
  // Create chart URL with simpler encoding
  const chartJson = JSON.stringify(chartConfig);
  const encodedChart = encodeURIComponent(chartJson);
  const chartUrl = `https://quickchart.io/chart?w=1200&h=600&f=png&bkg=white&c=${encodedChart}`;
  
  console.log('Chart URL generated, downloading...');
  
  try {
    const response = await axios({
      method: 'get',
      url: chartUrl,
      responseType: 'stream',
      timeout: 20000
    });
    
    const filename = `sentry-v9-performance-${Date.now()}.png`;
    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Chart saved as ${filename}`);
        console.log('\\n📈 Performance Summary:');
        console.log(`Memory: ${memoryStats.min}-${memoryStats.max}MB (avg: ${memoryStats.avg}MB)`);
        console.log(`CPU: ${cpuStats.min}-${cpuStats.max}% (avg: ${cpuStats.avg}%)`);
        console.log(`Duration: ${duration}s | Samples: ${dataPoints.length}`);
        console.log('\\n📊 Chart shows both memory and CPU usage on same scale for easy comparison');
        resolve(filename);
      });
      writer.on('error', reject);
    });
    
  } catch (error) {
    console.error('❌ Error downloading chart:', error.message);
    
    // Fallback: create separate charts
    console.log('🔄 Trying fallback approach with separate charts...');
    return await createSeparateCharts(dataPoints, memoryStats, cpuStats, duration);
  }
}

async function createSeparateCharts(dataPoints, memoryStats, cpuStats, duration) {
  const labels = dataPoints.map(p => p.time);
  const memoryData = dataPoints.map(p => p.memory);
  const cpuData = dataPoints.map(p => p.cpu);
  
  // Memory chart
  const memoryConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Memory Usage (MB)',
        data: memoryData,
        borderColor: 'rgb(54,162,235)',
        backgroundColor: 'rgba(54,162,235,0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Memory Usage: ${memoryStats.min}-${memoryStats.max}MB (avg: ${memoryStats.avg}MB)`
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Memory (MB)' },
          beginAtZero: false
        },
        x: {
          title: { display: true, text: 'Time (seconds)' }
        }
      }
    }
  };
  
  // CPU chart  
  const cpuConfig = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'CPU Usage (%)',
        data: cpuData,
        borderColor: 'rgb(255,99,132)',
        backgroundColor: 'rgba(255,99,132,0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `CPU Usage: ${cpuStats.min}-${cpuStats.max}% (avg: ${cpuStats.avg}%)`
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'CPU (%)' },
          beginAtZero: true
        },
        x: {
          title: { display: true, text: 'Time (seconds)' }
        }
      }
    }
  };
  
  try {
    // Generate both charts
    const memoryUrl = `https://quickchart.io/chart?w=800&h=400&f=png&bkg=white&c=${encodeURIComponent(JSON.stringify(memoryConfig))}`;
    const cpuUrl = `https://quickchart.io/chart?w=800&h=400&f=png&bkg=white&c=${encodeURIComponent(JSON.stringify(cpuConfig))}`;
    
    const timestamp = Date.now();
    const memoryFile = `sentry-v9-memory-${timestamp}.png`;
    const cpuFile = `sentry-v9-cpu-${timestamp}.png`;
    
    // Download memory chart
    const memoryResponse = await axios({ method: 'get', url: memoryUrl, responseType: 'stream', timeout: 15000 });
    const memoryWriter = fs.createWriteStream(memoryFile);
    memoryResponse.data.pipe(memoryWriter);
    
    await new Promise((resolve, reject) => {
      memoryWriter.on('finish', resolve);
      memoryWriter.on('error', reject);
    });
    
    // Download CPU chart
    const cpuResponse = await axios({ method: 'get', url: cpuUrl, responseType: 'stream', timeout: 15000 });
    const cpuWriter = fs.createWriteStream(cpuFile);
    cpuResponse.data.pipe(cpuWriter);
    
    await new Promise((resolve, reject) => {
      cpuWriter.on('finish', resolve);
      cpuWriter.on('error', reject);
    });
    
    console.log(`✅ Memory chart: ${memoryFile}`);
    console.log(`✅ CPU chart: ${cpuFile}`);
    
    return { memoryFile, cpuFile };
    
  } catch (error) {
    console.error('❌ Fallback charts also failed:', error.message);
    throw error;
  }
}

// Run the enhanced chart generator
createMemoryCpuChart().then((result) => {
  console.log('\\n🎉 Chart generation completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Chart generation failed:', error.message);
  process.exit(1);
});