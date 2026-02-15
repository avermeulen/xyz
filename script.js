let accelerometer = null;
let isTracking = false;
let dataHistory = [];
let currentMotionType = '';
let usingDeviceMotion = false; // Track which API we're using

function updateStatus(message, isActive) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = isActive ? 'status active' : 'status inactive';
}

async function requestMotionPermission() {
    // iOS 13+ requires explicit permission for DeviceMotion
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceMotionEvent.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting motion permission:', error);
            return false;
        }
    }
    // Non-iOS or older iOS - permission not required
    return true;
}

function startDeviceMotionTracking() {
    const handleMotion = (event) => {
        // DeviceMotionEvent provides acceleration data including gravity
        // accelerationIncludingGravity gives us the raw accelerometer data
        const acc = event.accelerationIncludingGravity;
        
        if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
            const x = acc.x.toFixed(2);
            const y = acc.y.toFixed(2);
            const z = acc.z.toFixed(2);
            
            // Update current display
            document.getElementById('xValue').textContent = x;
            document.getElementById('yValue').textContent = y;
            document.getElementById('zValue').textContent = z;
            document.getElementById('currentMotion').textContent = currentMotionType;
            
            // Record data
            recordData(x, y, z, currentMotionType);
        }
    };
    
    window.addEventListener('devicemotion', handleMotion);
    
    // Store the handler so we can remove it later
    window.currentMotionHandler = handleMotion;
    usingDeviceMotion = true;
    isTracking = true;
    
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'block';
    document.getElementById('motionType').disabled = true;
    
    updateStatus(`Tracking ${currentMotionType} motion...`, true);
}

async function startTracking() {
    const motionInput = document.getElementById('motionType').value.trim();
    if (!motionInput) {
        alert('Please enter a motion type (e.g., walk, run, jump)');
        return;
    }

    currentMotionType = motionInput;
    
    // Try Accelerometer API first (works on Android Chrome, desktop)
    if ('Accelerometer' in window) {
        try {
            // 10 Hz frequency provides good balance between data granularity and performance
            // Adjust this value based on your needs: higher = more data points, lower = less memory usage
            accelerometer = new Accelerometer({ frequency: 10 });
            
            accelerometer.addEventListener('reading', () => {
                const x = accelerometer.x.toFixed(2);
                const y = accelerometer.y.toFixed(2);
                const z = accelerometer.z.toFixed(2);
                
                // Update current display
                document.getElementById('xValue').textContent = x;
                document.getElementById('yValue').textContent = y;
                document.getElementById('zValue').textContent = z;
                document.getElementById('currentMotion').textContent = currentMotionType;
                
                // Record data
                recordData(x, y, z, currentMotionType);
            });

            accelerometer.addEventListener('error', (event) => {
                console.error('Accelerometer error:', event.error);
                if (event.error.name === 'NotAllowedError') {
                    alert('Permission to access accelerometer was denied. Please grant permission and try again.');
                } else if (event.error.name === 'NotReadableError') {
                    alert('Cannot read accelerometer data. Please check if another application is using the sensor.');
                } else {
                    alert('Accelerometer error: ' + event.error.message);
                }
                stopTracking();
            });

            accelerometer.start();
            usingDeviceMotion = false;
            isTracking = true;
            
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'block';
            document.getElementById('motionType').disabled = true;
            
            updateStatus(`Tracking ${currentMotionType} motion...`, true);
            return;
        } catch (error) {
            console.error('Error starting Accelerometer API:', error);
            console.log('Falling back to DeviceMotion API...');
        }
    }
    
    // Fallback to DeviceMotion API (works on iOS Safari/Chrome)
    if (typeof DeviceMotionEvent !== 'undefined') {
        // Request permission for iOS 13+
        const hasPermission = await requestMotionPermission();
        
        if (!hasPermission) {
            alert('Motion & Orientation access is required to track accelerometer data. Please grant permission in your browser settings.');
            return;
        }
        
        startDeviceMotionTracking();
    } else {
        alert('Accelerometer is not supported by your browser. Please use a device with accelerometer support and HTTPS connection.');
    }
}

function stopTracking() {
    if (usingDeviceMotion) {
        // Remove DeviceMotion event listener
        if (window.currentMotionHandler) {
            window.removeEventListener('devicemotion', window.currentMotionHandler);
            window.currentMotionHandler = null;
        }
        usingDeviceMotion = false;
    } else if (accelerometer) {
        // Stop Accelerometer API
        accelerometer.stop();
        accelerometer = null;
    }
    
    isTracking = false;
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('motionType').disabled = false;
    
    updateStatus('Tracking stopped', false);
}

function recordData(x, y, z, motionType) {
    const timestamp = new Date().toISOString();
    const dataPoint = {
        timestamp,
        x,
        y,
        z,
        motionType
    };
    
    dataHistory.push(dataPoint);
    
    // Update display
    updateHistoryDisplay();
    updateCSV();
}

function updateHistoryDisplay() {
    const container = document.getElementById('historyContainer');
    
    if (dataHistory.length === 0) {
        container.innerHTML = '<div class="empty-state">No data recorded yet. Start tracking to begin.</div>';
        return;
    }
    
    // Show last 20 entries
    const recentData = dataHistory.slice(-20).reverse();
    
    let html = '<table class="history-table"><thead><tr>';
    html += '<th>Timestamp</th><th>Motion Type</th><th>X</th><th>Y</th><th>Z</th>';
    html += '</tr></thead><tbody>';
    
    recentData.forEach(data => {
        const time = new Date(data.timestamp).toLocaleString();
        html += `<tr>
            <td>${time}</td>
            <td>${data.motionType}</td>
            <td>${data.x}</td>
            <td>${data.y}</td>
            <td>${data.z}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    
    if (dataHistory.length > 20) {
        html += `<p style="text-align: center; margin-top: 10px; color: #666;">
            Showing last 20 of ${dataHistory.length} entries
        </p>`;
    }
    
    container.innerHTML = html;
}

function updateCSV() {
    let csv = 'Timestamp,Motion Type,X,Y,Z\n';
    
    dataHistory.forEach(data => {
        csv += `${data.timestamp},${data.motionType},${data.x},${data.y},${data.z}\n`;
    });
    
    document.getElementById('csvOutput').value = csv;
}

function copyToClipboard(evt) {
    const csvOutput = document.getElementById('csvOutput');
    
    if (!csvOutput.value) {
        alert('No data to copy. Start tracking to generate data.');
        return;
    }
    
    // Use modern Clipboard API
    navigator.clipboard.writeText(csvOutput.value).then(() => {
        // Visual feedback
        const button = evt.target;
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        setTimeout(() => {
            button.textContent = originalText;
        }, 2000);
    }).catch((err) => {
        // Fallback for older browsers (execCommand is deprecated but kept for compatibility)
        csvOutput.select();
        try {
            document.execCommand('copy');
            const button = evt.target;
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        } catch (e) {
            alert('Failed to copy to clipboard. Please manually select and copy the text.');
        }
    });
}

function downloadCSV() {
    const csvOutput = document.getElementById('csvOutput').value;
    
    if (!csvOutput) {
        alert('No data to download. Start tracking to generate data.');
        return;
    }
    
    const blob = new Blob([csvOutput], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accelerometer-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function clearData() {
    if (dataHistory.length === 0) {
        alert('No data to clear.');
        return;
    }
    
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        dataHistory = [];
        updateHistoryDisplay();
        document.getElementById('csvOutput').value = '';
        alert('All data cleared.');
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    updateHistoryDisplay();
    
    // Check for sensor API support
    const hasAccelerometer = 'Accelerometer' in window;
    const hasDeviceMotion = typeof DeviceMotionEvent !== 'undefined';
    
    if (!hasAccelerometer && !hasDeviceMotion) {
        updateStatus('⚠️ Motion sensors not supported in this browser', false);
    } else if (!hasAccelerometer && hasDeviceMotion) {
        updateStatus('📱 Ready to track (using iOS motion sensors)', false);
    } else {
        updateStatus('Accelerometer not active - Click "Start Tracking" to begin', false);
    }
});
