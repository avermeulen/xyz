# 🎯 Accelerometer Data Tracker

A web-based application for tracking and recording accelerometer data from mobile devices and computers with motion sensors. This tool enables users to collect labeled motion data for machine learning and analysis purposes.

## Features

- **Real-time Accelerometer Tracking**: Capture X, Y, and Z axis accelerometer data in real-time
- **Motion Labeling**: Label your activities (walk, run, jump, stand, sit, etc.) for supervised learning
- **Automatic Classification**: Built-in Walk/Jump classifier that predicts motion type using time-window feature extraction
- **Cross-Platform Support**: 
  - Android/Desktop: Uses Accelerometer API
  - iOS: Uses DeviceMotion API with permission handling
- **Data Export**: Export collected data as CSV for further analysis
- **Visual Feedback**: Real-time display of current sensor readings and motion predictions
- **Data History**: View the last 20 recorded data points in a table format

## How to Use

1. **Open the Application**: Access `index.html` in a web browser on a device with accelerometer support
2. **Enter Motion Type**: Type the activity you'll be performing (e.g., "walk", "jump", "run")
3. **Start Tracking**: Click "Start Tracking" to begin recording sensor data
   - On iOS, you'll be prompted to grant motion sensor permissions
4. **Perform Motion**: Move your device while the selected motion is being tracked
5. **View Results**: See real-time readings and predicted motion classification
6. **Export Data**: Copy to clipboard or download the CSV file with all recorded data

## Technical Details

### Motion Classification

The application includes a `WalkJumpWindowClassifier` that:
- Processes accelerometer data in 500ms time windows
- Calculates statistical features (mean, standard deviation, max magnitude)
- Classifies motion as "Walk" or "Jump" based on configurable thresholds
- Uses magnitude-based feature extraction for motion detection

### Browser Compatibility

- **Modern Android/Chrome**: Uses Accelerometer API (10 Hz sampling rate)
- **iOS Safari/Chrome**: Uses DeviceMotion API with permission requests
- **HTTPS Required**: Motion sensors require a secure context

## Use Cases

- **Machine Learning Training Data**: Collect labeled data for training activity recognition models
- **Motion Analysis**: Study movement patterns and accelerometer characteristics
- **Educational Purposes**: Learn about sensor data and motion detection
- **Research Projects**: Gather data for biomechanics or activity recognition research

## Files

- `index.html` - Main application interface
- `script.js` - Core logic including sensor handling and classification
- `styles.css` - Modern, responsive UI styling
- `README.md` - This file

## Requirements

- Modern web browser with accelerometer or motion sensor support
- HTTPS connection (required for sensor access)
- Device with accelerometer/motion sensors (smartphone, tablet, or laptop with sensors)

## Getting Started

Simply open `index.html` in your browser on a supported device. No build process or dependencies required!

---

*Note: This is a client-side application that runs entirely in your browser. No data is sent to any server.*