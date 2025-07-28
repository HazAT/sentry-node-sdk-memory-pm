const QuickChart = require('quickchart-js');
const axios = require('axios');
const fs = require('fs');

async function testChart() {
  console.log('Testing QuickChart integration...');
  
  // Simple test data
  const chartConfig = {
    type: 'line',
    data: {
      labels: ['10:00', '10:01', '10:02', '10:03', '10:04'],
      datasets: [{
        label: 'Memory Usage (MB)',
        data: [50, 75, 60, 80, 65],
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Test Memory Chart'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Memory (MB)'
          }
        }
      }
    }
  };

  try {
    const chart = new QuickChart();
    chart
      .setConfig(chartConfig)
      .setWidth(800)
      .setHeight(400)
      .setBackgroundColor('white');

    const chartUrl = chart.getUrl();
    console.log('Chart URL:', chartUrl);

    // Download the image
    console.log('Downloading chart...');
    const response = await axios({
      method: 'get',
      url: chartUrl,
      responseType: 'stream',
      timeout: 10000
    });

    const filename = 'test-chart.png';
    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ Test chart saved as ${filename}`);
        resolve(filename);
      });
      writer.on('error', (error) => {
        console.error('❌ Error saving chart:', error);
        reject(error);
      });
    });

  } catch (error) {
    console.error('❌ Error generating chart:', error.message);
    throw error;
  }
}

testChart().then(() => {
  console.log('Chart test completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Chart test failed:', error);
  process.exit(1);
});