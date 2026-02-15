// MotionClassifier: Time-based window feature extraction and 3-class classification
class MotionClassifier {
    static LABEL_SITTING = 'Sitting';
    static LABEL_WALK = 'Walk';
    static LABEL_JUMP = 'Jump';
    
    constructor(config = {}) {
        this.windowMs = config.windowMs || 500;
        this.minSamples = config.minSamples || 10;
        this.sitStdThreshold = config.sitStdThreshold || 0.5;
        this.jumpStdThreshold = config.jumpStdThreshold || 3.0;
        this.jumpMaxThreshold = config.jumpMaxThreshold || 15.0;
        
        this.reset();
    }
    
    reset() {
        this.windowStart = null;
        this.mags = [];
        this.samples = [];
    }
    
    magnitude(x, y, z) {
        return Math.sqrt(x * x + y * y + z * z);
    }
    
    mean(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    }
    
    std(arr) {
        if (arr.length === 0) return 0;
        const avg = this.mean(arr);
        const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
        return Math.sqrt(this.mean(squareDiffs));
    }
    
    addSample({tMs, x, y, z}) {
        // Initialize window start on first sample
        if (this.windowStart === null) {
            this.windowStart = tMs;
        }
        
        // Calculate magnitude
        const mag = this.magnitude(x, y, z);
        this.mags.push(mag);
        this.samples.push({tMs, x, y, z, mag});
        
        // Check if window is complete
        if (tMs - this.windowStart >= this.windowMs) {
            // Check if we have minimum samples
            if (this.mags.length < this.minSamples) {
                // Discard window and start fresh
                this.reset();
                return null;
            }
            
            // Extract features
            const mean_mag = this.mean(this.mags);
            const std_mag = this.std(this.mags);
            const max_mag = this.mags.reduce((a, b) => Math.max(a, b), -Infinity);
            
            const features = {
                mean_mag,
                std_mag,
                max_mag
            };
            
            // Classify using 3-class rule
            let label;
            if (std_mag > this.jumpStdThreshold || max_mag > this.jumpMaxThreshold) {
                label = MotionClassifier.LABEL_JUMP;
            } else if (std_mag < this.sitStdThreshold) {
                label = MotionClassifier.LABEL_SITTING;
            } else {
                label = MotionClassifier.LABEL_WALK;
            }
            
            const result = {
                label,
                features,
                samples: this.samples.length
            };
            
            // Reset for next window
            this.reset();
            
            return result;
        }
        
        return null;
    }
}

let accelerometer = null;
let isTracking = false;
let dataHistory = [];
let currentMotionType = '';
let predictedMotion = ''; // Current predicted motion type
let usingDeviceMotion = false; // Track which API we're using
let motionHandler = null; // Handler for DeviceMotion events
let classifier = new MotionClassifier({
    windowMs: 500,
    minSamples: 10,
    sitStdThreshold: 0.5,
    jumpStdThreshold: 3.0,
    jumpMaxThreshold: 15.0
}); // Window-based 3-class classifier

let sessionDataCount = 0; // Counter for data points in current tracking session
let isDataModeEnabled = false; // Flag to track if data collection mode is enabled

function toggleDataMode() {
    const checkbox = document.getElementById('dataMode');
    isDataModeEnabled = checkbox.checked;
    
    // Toggle visibility of data-related sections using CSS classes
    const dataCounterContainer = document.getElementById('dataCounterContainer');
    const dataHistorySection = document.getElementById('dataHistorySection');
    const exportSection = document.getElementById('exportSection');
    
    if (isDataModeEnabled) {
        dataCounterContainer.classList.remove('hidden');
        dataHistorySection.classList.remove('hidden');
        exportSection.classList.remove('hidden');
    } else {
        dataCounterContainer.classList.add('hidden');
        dataHistorySection.classList.add('hidden');
        exportSection.classList.add('hidden');
    }
}

function updateStatus(message, isActive) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = isActive ? 'status active' : 'status inactive';
}

function updateDataCounter() {
    const counterEl = document.getElementById('dataCounter');
    if (counterEl) {
        counterEl.textContent = sessionDataCount;
    }
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
    motionHandler = (event) => {
        // DeviceMotionEvent provides acceleration data including gravity
        // accelerationIncludingGravity gives us the raw accelerometer data
        const acc = event.accelerationIncludingGravity;
        
        if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
            // Keep numeric values
            const x = acc.x;
            const y = acc.y;
            const z = acc.z;
            
            // Update current display with formatted values
            document.getElementById('xValue').textContent = x.toFixed(2);
            document.getElementById('yValue').textContent = y.toFixed(2);
            document.getElementById('zValue').textContent = z.toFixed(2);
            document.getElementById('currentMotion').textContent = currentMotionType;
            
            // Add sample to classifier
            const result = classifier.addSample({
                tMs: Date.now(),
                x,
                y,
                z
            });
            
            // Update prediction if window completed
            if (result) {
                predictedMotion = result.label;
                updatePredictionDisplay();
            }
            
            // Record data with numeric values
            recordData(x, y, z, currentMotionType, predictedMotion);
        }
    };
    
    window.addEventListener('devicemotion', motionHandler);
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
    
    // Reset classifier and prediction
    classifier.reset();
    predictedMotion = '';
    updatePredictionDisplay();
    
    // Reset session data counter
    sessionDataCount = 0;
    updateDataCounter();
    
    // Try Accelerometer API first (works on Android Chrome, desktop)
    if ('Accelerometer' in window) {
        try {
            // 10 Hz frequency provides good balance between data granularity and performance
            // Adjust this value based on your needs: higher = more data points, lower = less memory usage
            accelerometer = new Accelerometer({ frequency: 10 });
            
            accelerometer.addEventListener('reading', () => {
                // Keep numeric values
                const x = accelerometer.x;
                const y = accelerometer.y;
                const z = accelerometer.z;
                
                // Update current display with formatted values
                document.getElementById('xValue').textContent = x.toFixed(2);
                document.getElementById('yValue').textContent = y.toFixed(2);
                document.getElementById('zValue').textContent = z.toFixed(2);
                document.getElementById('currentMotion').textContent = currentMotionType;
                
                // Add sample to classifier
                const result = classifier.addSample({
                    tMs: Date.now(),
                    x,
                    y,
                    z
                });
                
                // Update prediction if window completed
                if (result) {
                    predictedMotion = result.label;
                    updatePredictionDisplay();
                }
                
                // Record data with numeric values
                recordData(x, y, z, currentMotionType, predictedMotion);
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
        if (motionHandler) {
            window.removeEventListener('devicemotion', motionHandler);
            motionHandler = null;
        }
        usingDeviceMotion = false;
    } else if (accelerometer) {
        // Stop Accelerometer API
        accelerometer.stop();
        accelerometer = null;
    }
    
    // Reset classifier and prediction
    classifier.reset();
    predictedMotion = '';
    updatePredictionDisplay();
    
    isTracking = false;
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('motionType').disabled = false;
    
    updateStatus('Tracking stopped', false);
}

function updatePredictionDisplay() {
    const predictionEl = document.getElementById('predictedMotion');
    if (predictionEl) {
        predictionEl.textContent = predictedMotion || '-';
    }
}

function formatAccelValue(value) {
    return typeof value === 'number' ? value.toFixed(2) : value;
}

function recordData(x, y, z, motionType, predictedMotion) {
    // Only record data if data mode is enabled
    if (!isDataModeEnabled) {
        return;
    }
    
    const timestamp = new Date().toISOString();
    const dataPoint = {
        timestamp,
        x,
        y,
        z,
        motionType,
        predictedMotion: predictedMotion || ''
    };
    
    dataHistory.push(dataPoint);
    
    // Increment session data counter
    sessionDataCount++;
    updateDataCounter();
    
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
    html += '<th>Timestamp</th><th>Motion Type</th><th>Predicted</th><th>X</th><th>Y</th><th>Z</th>';
    html += '</tr></thead><tbody>';
    
    recentData.forEach(data => {
        const time = new Date(data.timestamp).toLocaleString();
        html += `<tr>
            <td>${time}</td>
            <td>${data.motionType}</td>
            <td>${data.predictedMotion || '-'}</td>
            <td>${formatAccelValue(data.x)}</td>
            <td>${formatAccelValue(data.y)}</td>
            <td>${formatAccelValue(data.z)}</td>
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
    let csv = 'Timestamp,Motion Type,Predicted,X,Y,Z\n';
    
    dataHistory.forEach(data => {
        const x = formatAccelValue(data.x);
        const y = formatAccelValue(data.y);
        const z = formatAccelValue(data.z);
        csv += `${data.timestamp},${data.motionType},${data.predictedMotion || ''},${x},${y},${z}\n`;
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
    // Initialize data mode state from checkbox
    const checkbox = document.getElementById('dataMode');
    if (checkbox) {
        isDataModeEnabled = checkbox.checked;
        // Sync UI with initial checkbox state
        toggleDataMode();
    }
    
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
