// dashboard.js

const API_BASE = 'http://localhost:3001/api';
let users = [];
let charts = {};
let selectedUserID = null;
let currentSessions = []; // Store fetched sessions for current user

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        users = await response.json();
        
        const minSessions = parseInt(document.getElementById('minSessions').value) || 0;
        const filteredUsers = users.filter(user => user.totalSessions >= minSessions);

        const userList = document.getElementById('userList');
        userList.innerHTML = '';
        
        filteredUsers.forEach(user => {
            const row = document.createElement('tr');
            row.id = `user-${user.userID}`;
            if (user.userID === selectedUserID) row.classList.add('selected');
            row.innerHTML = `<td>${user.userID}</td><td>${user.totalSessions}</td>`;
            row.onclick = () => selectUser(user.userID);
            userList.appendChild(row);
        });
    } catch (err) {
        console.error('Failed to load users:', err);
    }
}

async function selectUser(userID) {
    selectedUserID = userID;
    document.querySelectorAll('#userList tr').forEach(r => r.classList.remove('selected'));
    const selectedRow = document.getElementById(`user-${userID}`);
    if (selectedRow) selectedRow.classList.add('selected');
    
    document.getElementById('detailView').style.display = 'block';
    document.getElementById('currentUserID').innerText = `User ID: ${userID}`;
    
    // Reset data to prevent leakage while loading
    currentSessions = [];
    refreshCurrentView();

    try {
        const response = await fetch(`${API_BASE}/users/${userID}/sessions`);
        const sessions = await response.json();
        
        // Guard against race conditions if user was changed during fetch
        if (selectedUserID !== userID) return;
        
        currentSessions = sessions;

        // Populate session selector for checkpoint view
        const sessionSelector = document.getElementById('sessionSelector');
        sessionSelector.innerHTML = '';
        currentSessions.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = `Session ${i + 1}`;
            sessionSelector.appendChild(opt);
        });

        document.getElementById('userDetailStats').innerText = `Total Sessions: ${currentSessions.length}`;
        
        refreshCurrentView();
        updateTrends();
    } catch (err) {
        console.error(`Failed to load sessions for ${userID}:`, err);
    }
}

function refreshCurrentView() {
    const level = document.getElementById('levelSelector').value;
    const viewMode = document.getElementById('viewMode').value;
    const sessionIdx = document.getElementById('sessionSelector').value;
    
    document.getElementById('sessionSelectorContainer').style.display = level === 'Checkpoint' ? 'block' : 'none';

    let dataToDisplay = [];

    if (currentSessions.length > 0) {
        if (level === 'Session') {
            dataToDisplay = currentSessions.map((s, i) => ({
                label: `S${i + 1}`,
                rt: s.avgReactionTime || s.average_reaction_time_ms || 0,
                accuracy: (s.avgAccuracy || s.average_accuracy || 0) * 100,
                error: s.avgErrorRate || s.average_spatial_distance_error || 0,
                trials: s.number_of_trials || 0
            }));
        } else {
            const session = currentSessions[sessionIdx];
            if (session && session.checkpoints) {
                dataToDisplay = session.checkpoints.map((c, i) => ({
                    label: `C${i + 1}`,
                    rt: c.avgReactionTime || 0,
                    accuracy: (c.accuracy || 0) * 100,
                    error: c.errorRate || 0,
                    trials: c.moves || 0
                }));
            }
        }
    }

    if (viewMode === 'Smoothed' && dataToDisplay.length > 0) {
        dataToDisplay = applySmoothing(dataToDisplay);
    }

    updateTable(dataToDisplay);
    updateCharts(dataToDisplay);
}

function applySmoothing(data) {
    if (data.length < 3) return data;
    const windowSize = 3;
    return data.map((d, i) => {
        if (i < windowSize - 1) return d;
        const window = data.slice(i - windowSize + 1, i + 1);
        return {
            ...d,
            rt: window.reduce((sum, val) => sum + val.rt, 0) / windowSize,
            accuracy: window.reduce((sum, val) => sum + val.accuracy, 0) / windowSize,
            error: window.reduce((sum, val) => sum + val.error, 0) / windowSize
        };
    });
}

function updateTable(data) {
    const sessionList = document.getElementById('sessionList');
    sessionList.innerHTML = '';
    data.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${d.label}</td>
            <td>${d.trials}</td>
            <td>${d.accuracy.toFixed(1)}%</td>
            <td>${Math.round(d.rt)}</td>
            <td>${d.error.toFixed(2)}</td>
            <td>-</td>
        `;
        sessionList.appendChild(row);
    });
}

function updateTrends() {
    const ltTrend = document.getElementById('longTermTrend');
    const statusEl = document.getElementById('currentStatus');

    if (currentSessions.length === 0) {
        ltTrend.innerText = '-';
        statusEl.innerText = '-';
        return;
    }

    // Long-term trend
    const accuracies = currentSessions.map(s => s.avgAccuracy || s.average_accuracy || 0);
    if (accuracies.length >= 3) {
        const start = accuracies.slice(0, 2).reduce((a, b) => a + b) / 2;
        const end = accuracies.slice(-2).reduce((a, b) => a + b) / 2;
        if (end > start + 0.05) { ltTrend.innerText = 'Improving'; ltTrend.style.color = '#4caf50'; }
        else if (end < start - 0.05) { ltTrend.innerText = 'Declining'; ltTrend.style.color = '#f44336'; }
        else { ltTrend.innerText = 'Stable'; ltTrend.style.color = '#aaa'; }
    } else {
        ltTrend.innerText = 'Stable';
        ltTrend.style.color = '#aaa';
    }

    // Current Status (within last session)
    const lastSession = currentSessions[currentSessions.length - 1];
    if (lastSession.checkpoints && lastSession.checkpoints.length >= 2) {
        const cps = lastSession.checkpoints;
        const n = cps.length;
        const rtTrend = (cps[n-1].avgReactionTime - cps[0].avgReactionTime) / n;
        if (rtTrend > 50) { statusEl.innerText = 'Severe Fatigue'; statusEl.style.color = '#f44336'; }
        else if (rtTrend > 20) { statusEl.innerText = 'Early Fatigue'; statusEl.style.color = '#ff9800'; }
        else { statusEl.innerText = 'Stable'; statusEl.style.color = '#4caf50'; }
    } else {
        statusEl.innerText = 'Stable';
        statusEl.style.color = '#4caf50';
    }
}

function updateCharts(data) {
    // Destroy all existing charts
    Object.keys(charts).forEach(id => {
        if (charts[id]) {
            charts[id].destroy();
            charts[id] = null;
        }
    });

    if (data.length === 0) return;

    const labels = data.map(d => d.label);
    const rtData = data.map(d => d.rt);
    const accuracyData = data.map(d => d.accuracy);
    const errorData = data.map(d => d.error);

    function refreshChart(id, label, chartData, color) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: chartData,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                animation: { duration: 400 },
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
    refreshChart('pixelErrorChart', 'Spatial Error', errorData, '#f44336');
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

loadUsers();
setInterval(loadUsers, 10000);
