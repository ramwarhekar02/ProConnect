#!/usr/bin/env python3
"""
OEE Monitoring System - Raspberry Pi Data Sender
Sends machine data and heartbeats to the backend server
"""

import requests
import time
import json
import logging
from datetime import datetime
from typing import Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OEEDataSender:
    def __init__(self, backend_url: str = 'http://localhost:5000/api', machine_id: str = 'KM-001'):
        """
        Initialize OEE Data Sender
        
        Args:
            backend_url: Base URL of the OEE monitoring backend
            machine_id: Unique identifier for the machine
        """
        self.backend_url = backend_url.rstrip('/')
        self.machine_id = machine_id.upper()
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        logger.info(f"Initialized OEE Data Sender for {self.machine_id}")
        logger.info(f"Backend URL: {self.backend_url}")
    
    def send_heartbeat(self, status: str = 'running') -> bool:
        """
        Send machine heartbeat to backend
        
        Args:
            status: Machine status (running, idle, down)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"{self.backend_url}/machines/{self.machine_id}/heartbeat"
            payload = {'status': status}
            
            response = self.session.post(url, json=payload, timeout=5)
            response.raise_for_status()
            
            logger.info(f"✓ Heartbeat sent: {status}")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"✗ Heartbeat failed: {str(e)}")
            return False
    
    def send_production_data(
        self,
        total_pieces: int,
        defective_pieces: int,
        runtime_seconds: int,
        downtime_seconds: int,
        planned_production_time_seconds: int,
        ideal_cycle_time_seconds: float = 1.0
    ) -> Optional[Dict]:
        """
        Send production data to backend
        
        Args:
            total_pieces: Total pieces produced
            defective_pieces: Number of defective pieces
            runtime_seconds: Machine runtime in seconds
            downtime_seconds: Machine downtime in seconds
            planned_production_time_seconds: Planned production time in seconds
            ideal_cycle_time_seconds: Ideal cycle time per piece
        
        Returns:
            Response data with OEE metrics, or None if failed
        """
        try:
            url = f"{self.backend_url}/production/{self.machine_id}"
            payload = {
                'totalPieces': total_pieces,
                'defectivePieces': defective_pieces,
                'runtimeSeconds': runtime_seconds,
                'downtimeSeconds': downtime_seconds,
                'plannedProductionTimeSeconds': planned_production_time_seconds,
                'idealCycleTimeSeconds': ideal_cycle_time_seconds,
                'timestamp': datetime.now().isoformat()
            }
            
            response = self.session.post(url, json=payload, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                oee_metrics = data.get('oeeMetrics', {})
                logger.info(
                    f"✓ Production data sent - "
                    f"OEE: {oee_metrics.get('oee', 0):.2f}% "
                    f"| Availability: {oee_metrics.get('availability', 0):.2f}% "
                    f"| Performance: {oee_metrics.get('performance', 0):.2f}% "
                    f"| Quality: {oee_metrics.get('quality', 0):.2f}%"
                )
                return oee_metrics
            else:
                logger.error(f"Server error: {data.get('message')}")
                return None
            
        except requests.exceptions.RequestException as e:
            logger.error(f"✗ Production data failed: {str(e)}")
            return None
    
    def start_monitoring(
        self,
        heartbeat_interval: int = 5,
        data_interval: int = 60
    ):
        """
        Start continuous monitoring and data sending
        
        Args:
            heartbeat_interval: Seconds between heartbeats (default: 5)
            data_interval: Seconds between production data sends (default: 60)
        """
        logger.info(f"Starting monitoring with {heartbeat_interval}s heartbeat, {data_interval}s data send")
        
        heartbeat_counter = 0
        data_counter = 0
        
        try:
            while True:
                # Send heartbeat
                if heartbeat_counter >= heartbeat_interval:
                    self.send_heartbeat('running')
                    heartbeat_counter = 0
                
                # Send production data
                if data_counter >= data_interval:
                    # Simulate production data
                    # In real scenario, read from GPIO/sensors
                    self.send_production_data(
                        total_pieces=150,
                        defective_pieces=3,
                        runtime_seconds=900,
                        downtime_seconds=60,
                        planned_production_time_seconds=960,
                        ideal_cycle_time_seconds=6
                    )
                    data_counter = 0
                
                heartbeat_counter += 1
                data_counter += 1
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")


# Simulated Sensor Data (Replace with actual GPIO reading)
class MachineSimulator:
    """Simulates machine production data for testing"""
    
    def __init__(self):
        self.total_pieces = 0
        self.defective_pieces = 0
        self.runtime_seconds = 0
        self.downtime_seconds = 0
    
    def simulate_production(self, duration_seconds: int = 60):
        """Simulate 1 minute of production"""
        
        # Simulate 10 pieces per second production
        pieces_produced = duration_seconds * 10
        defects = max(0, int(pieces_produced * 0.02))  # 2% defect rate
        
        self.total_pieces += pieces_produced
        self.defective_pieces += defects
        self.runtime_seconds += int(duration_seconds * 0.95)  # 95% utilization
        self.downtime_seconds += int(duration_seconds * 0.05)  # 5% downtime
        
        return {
            'total_pieces': self.total_pieces,
            'defective_pieces': self.defective_pieces,
            'runtime_seconds': self.runtime_seconds,
            'downtime_seconds': self.downtime_seconds
        }


# Example Usage
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='OEE Monitoring Data Sender')
    parser.add_argument('--url', default='http://localhost:5000/api', help='Backend URL')
    parser.add_argument('--machine-id', default='KM-001', help='Machine ID')
    parser.add_argument('--heartbeat', type=int, default=5, help='Heartbeat interval in seconds')
    parser.add_argument('--data-interval', type=int, default=60, help='Data send interval in seconds')
    
    args = parser.parse_args()
    
    # Create sender
    sender = OEEDataSender(
        backend_url=args.url,
        machine_id=args.machine_id
    )
    
    # Optional: Use simulator
    simulator = MachineSimulator()
    
    # Start monitoring
    try:
        sender.start_monitoring(
            heartbeat_interval=args.heartbeat,
            data_interval=args.data_interval
        )
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")

"""
RASPBERRY PI SETUP INSTRUCTIONS:

1. Install Python dependencies:
   sudo apt-get update
   sudo apt-get install python3-pip python3-requests

2. Install requests library:
   pip3 install requests

3. Create this script on your Pi:
   nano oee_sender.py
   # Paste this entire content

4. Make it executable:
   chmod +x oee_sender.py

5. Run the script:
   python3 oee_sender.py --url http://your-backend:5000/api --machine-id KM-001

6. For automatic startup, add to crontab:
   crontab -e
   # Add this line:
   @reboot python3 /home/pi/oee_sender.py &

7. Real GPIO Integration (Example with RPi.GPIO):
   import RPi.GPIO as GPIO
   
   # Read actual sensor data
   def read_production_data():
       total = GPIO.input(PIN_TOTAL_COUNTER)
       defects = GPIO.input(PIN_DEFECT_COUNTER)
       # ... more sensor reads
       return total, defects, runtime, downtime

8. For debugging:
   python3 oee_sender.py --heartbeat 2 --data-interval 10

Notes:
- Replace simulated data with actual sensor readings
- Add error recovery for network disconnections
- Implement local data buffering for offline scenarios
- Use systemd service for production reliability
"""
