// Analytics functionality
let weeklyChart = null;
let statusChart = null;

// Load analytics data
function loadAnalytics() {
    loadSummaryData();
    loadWeeklyChart();
    loadStatusChart();
}

// Load summary cards data
function loadSummaryData() {
    fetch(`${API_URL}/analytics/summary`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('totalFedToday').textContent = data.total_fed_today.toFixed(0) + 'g';
            document.getElementById('activeModules').textContent = $`{data.active_modules}/${data.total_modules}`;
        })
        .catch(error => console.error('Error loading summary:', error));
}

// Load weekly feeding chart
function loadWeeklyChart() {
    fetch(`${API_URL}/analytics/weekly`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('weeklyChart').getContext('2d');
            
            // Destroy existing chart if it exists
            if (weeklyChart) {
                weeklyChart.destroy();
            }

            // Prepare data with all days of week
            const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const chartData = allDays.map(day => {
                const found = data.find(d => d.day === day);
                return found ? found.amount : 0;
            });

            weeklyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: allDays,
                    datasets: [{
                        label: 'Amount Fed (g)',
                        data: chartData,
                        backgroundColor: 'rgba(255, 107, 53, 0.7)',
                        borderColor: 'rgba(255, 107, 53, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value + 'g';
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        })
        .catch(error => console.error('Error loading weekly chart:', error));
}

// Load module status chart
function loadStatusChart() {
    fetch(`${API_URL}/analytics/module-status`)
        .then(response => response.json())
        .then(data => {
            const ctx = document.getElementById('statusChart').getContext('2d');
            
            // Destroy existing chart if it exists
            if (statusChart) {
                statusChart.destroy();
            }

            const labels = data.map(d => d.status.charAt(0).toUpperCase() + d.status.slice(1));
            const counts = data.map(d => d.count);
            const colors = data.map(d => d.status === 'active' ? '#22c55e' : '#ef4444');

            statusChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: colors,
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        })
        .catch(error => console.error('Error loading status chart:', error));
}

// Load analytics on page load
loadAnalytics();

// Refresh analytics every 10 seconds
setInterval(loadAnalytics, 10000);