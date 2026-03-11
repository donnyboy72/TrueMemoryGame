// dashboard.js

const API_BASE = 'http://localhost:3001/api';
let users = [];
let charts = {};

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        users = await response.json();
        
        // Filter users based on min sessions and date range
        const minSessions = parseInt(document.getElementById('minSessions').value) || 0;
        const dateStart = document.getElementById('dateStart').value;
        const dateEnd = document.getElementById('dateEnd').value;
        
        const filteredUsers = users.filter(user => {
            if (user.totalSessions < minSessions) return false;
            
            // Check if user has session dates
            if (user.firstSession && user.lastSession) {
                const firstDate = new Date(user.firstSession).toISOString().split('T')[0];
                const lastDate = new Date(user.lastSession).toISOString().split('T')[0];
                
                if (dateStart && lastDate < dateStart) return false;
                if (dateEnd && firstDate > dateEnd) return false;
            } else if (dateStart || dateEnd) {
                return false; // No sessions but a date filter is active
            }
            
            return true;
        });

        const userList = document.getElementById('userList');
        userList.innerHTML = '';
        
        filteredUsers.forEach(user => {
            const row = document.createElement('tr');
            row.id = `user-${user.userID}`;
            row.innerHTML = `
                <td>${user.userID}</td>
                <td>${user.totalSessions}</td>
            `;
            row.onclick = () => selectUser(user.userID);
            userList.appendChild(row);
        });
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

async function selectUser(userID) {
    // UI selection state
    document.querySelectorAll('#userList tr').forEach(r => r.classList.remove('selected'));
    document.getElementById(`user-${userID}`).classList.add('selected');
    
    // Show detail view
    document.getElementById('detailView').style.display = 'block';
    document.getElementById('currentUserID').innerText = `User ID: ${userID}`;
    
    try {
        const response = await fetch(`${API_BASE}/users/${userID}/sessions`);
        const sessions = await response.json();
        
        const lastActive = sessions.length > 0 ? new Date(sessions[sessions.length - 1].session_timestamp).toLocaleString() : 'N/A';
        document.getElementById('userDetailStats').innerText = `Total Sessions: ${sessions.length} | Last Active: ${lastActive}`;
        
        // Populate session table
        const sessionList = document.getElementById('sessionList');
        sessionList.innerHTML = '';
        sessions.forEach((s, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(s.session_timestamp).toLocaleString()}</td>
                <td>${s.number_of_trials}</td>
                <td>${(s.average_accuracy * 100).toFixed(1)}%</td>
                <td>${Math.round(s.average_reaction_time_ms)}</td>
                <td>${s.average_spatial_distance_error.toFixed(2)}</td>
                <td>${s.average_pixel_distance_error.toFixed(1)}</td>
            `;
            sessionList.appendChild(row);
        });

        // Update Charts
        updateCharts(sessions);
    } catch (err) {
        console.error(`Failed to load sessions for ${userID}:`, err);
    }
}

function updateCharts(sessions) {
    const labels = sessions.map((s, i) => `Session ${i + 1}`);
    const rtData = sessions.map(s => s.average_reaction_time_ms);
    const accuracyData = sessions.map(s => s.average_accuracy * 100);
    const pixelErrorData = sessions.map(s => s.average_pixel_distance_error);

    // Helper to create or update chart
    function refreshChart(id, label, data, color) {
        if (charts[id]) charts[id].destroy();
        const ctx = document.getElementById(id).getContext('2d');
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: 'white' } } },
                scales: {
                    x: { ticks: { color: 'white' }, grid: { color: '#444' } },
                    y: { ticks: { color: 'white' }, grid: { color: '#444' } }
                }
            }
        });
    }

    refreshChart('rtChart', 'Reaction Time (ms)', rtData, '#646cff');
    refreshChart('accuracyChart', 'Accuracy (%)', accuracyData, '#4caf50');
    refreshChart('pixelErrorChart', 'Pixel Error (px)', pixelErrorData, '#f44336');
}

async function exportData() {
    try {
        const response = await fetch(`${API_BASE}/export`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'research_dataset.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Failed to export data:', err);
    }
}

// Initial load
loadUsers();
setInterval(loadUsers, 5000); // Auto-refresh user list every 5 seconds
