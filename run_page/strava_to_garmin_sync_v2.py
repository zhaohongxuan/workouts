"""
Strava to Garmin Sync - Using Strava API Streams (No JWT required!)

This script uses stravalib's get_activity_streams() to get activity data,
then converts it to FIT format using fit_tool library.
This eliminates the need for stravaweblib's JWT authentication.

Usage:
    python strava_to_garmin_sync_v2.py CLIENT_ID CLIENT_SECRET REFRESH_TOKEN GARMIN_SECRET [--is-cn]
"""

import argparse
import asyncio
import os
import sys
import traceback
from datetime import datetime
from io import BytesIO
from typing import Optional

import httpx
import tenacity
from stravalib.client import Client

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from garmin_sync import Garmin
from utils import make_strava_client, get_strava_last_time


# FIT file generation using fit_tool
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.file_creator_message import FileCreatorMessage
from fit_tool.profile.messages.activity_message import ActivityMessage
from fit_tool.profile.messages.session_message import SessionMessage
from fit_tool.profile.messages.lap_message import LapMessage
from fit_tool.profile.messages.record_message import RecordMessage
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.device_info_message import DeviceInfoMessage


# Garmin device info for wrapping
try:
    from garmin_device_adaptor import wrap_device_info, is_fit_file
except ImportError:
    # Fallback if garmin_device_adaptor not available
    def wrap_device_info(f):
        return BytesIO(f.read())
    def is_fit_file(f):
        return False


# Stream types we want to fetch
STREAM_TYPES = ['time', 'latlng', 'altitude', 'heartrate', 'cadence', 
                'watts', 'distance', 'speed', 'moving', 'grade_smooth']


def strava_to_fit_activity(activity_id: int, streams: dict, activity_info: dict) -> bytes:
    """
    Convert Strava activity streams to FIT format.
    
    Args:
        activity_id: Strava activity ID
        streams: Dict of stream data from stravalib
        activity_info: Dict with activity metadata (name, start_date, type, etc.)
    
    Returns:
        bytes: FIT file content
    """
    builder = FitFileBuilder(auto_define=True)
    
    # File ID message
    file_id = FileIdMessage()
    file_id.type = 4  # activity
    file_id.manufacturer = 1  # Garmin
    file_id.product = 0
    file_id.time_created = datetime.now()
    file_id.serial_number = 0
    builder.add(file_id)
    
    # File creator message
    file_creator = FileCreatorMessage()
    file_creator.software_version = 1
    file_creator.hardware_version = 0
    builder.add(file_creator)
    
    # Device info message
    device_info = DeviceInfoMessage()
    device_info.device_index = 0
    device_info.manufacturer = 1  # Garmin
    device_info.garmin_product = 0
    device_info.software_version = 1.0
    builder.add(device_info)
    
    # Activity message
    activity = ActivityMessage()
    activity.timestamp = datetime.now()
    activity.total_timer_time = streams.get('time', [0])[-1] if 'time' in streams else 0
    activity.num_sessions = 1
    activity.type = 0  # manual
    activity.event = 0  # activity
    activity.event_type = 2  # stop
    builder.add(activity)
    
    # Session message
    session = SessionMessage()
    session.timestamp = datetime.now()
    session.event = 7  # session
    session.event_type = 2  # stop
    session.start_time = activity_info.get('start_date', datetime.now())
    session.sport = 1  # generic (will be set based on activity type)
    session.sub_sport = 0
    session.total_elapsed_time = streams.get('time', [0])[-1] if 'time' in streams else 0
    session.total_timer_time = streams.get('time', [0])[-1] if 'time' in streams else 0
    if 'distance' in streams and streams['distance']:
        session.total_distance = streams['distance'][-1]
    session.first_lap_index = 0
    session.num_laps = 1
    session.trigger = 7  # activity_end
    builder.add(session)
    
    # Event message - start
    event_start = EventMessage()
    event_start.timestamp = activity_info.get('start_date', datetime.now())
    event_start.event = 0  # timer
    event_start.event_type = 0  # start
    event_start.event_group = 0
    builder.add(event_start)
    
    # Record messages (GPS points)
    if 'time' in streams and streams['time']:
        times = streams['time']
        start_time = activity_info.get('start_date', datetime.now())
        
        # Calculate elapsed time for first point
        first_ts = times[0]
        
        for i in range(len(times)):
            record = RecordMessage()
            
            # Timestamp (relative to activity start)
            record.timestamp = int(first_ts + times[i])
            
            # GPS coordinates
            if 'latlng' in streams and streams['latlng'] and i < len(streams['latlng']):
                lat, lon = streams['latlng'][i]
                # Convert to semicircles (FIT format)
                record.position_lat = lat * (2**31 / 180)
                record.position_long = lon * (2**31 / 180)
            
            # Altitude (convert from meters to FIT format)
            if 'altitude' in streams and streams['altitude'] and i < len(streams['altitude']):
                record.altitude = streams['altitude'][i]  # FIT expects meters
            
            # Heart rate
            if 'heartrate' in streams and streams['heartrate'] and i < len(streams['heartrate']):
                record.heart_rate = int(streams['heartrate'][i])
            
            # Cadence
            if 'cadence' in streams and streams['cadence'] and i < len(streams['cadence']):
                record.cadence = int(streams['cadence'][i])
            
            # Distance
            if 'distance' in streams and streams['distance'] and i < len(streams['distance']):
                record.distance = streams['distance'][i]
            
            # Speed (m/s)
            if 'speed' in streams and streams['speed'] and i < len(streams['speed']):
                record.speed = streams['speed'][i]
            
            # Power (watts)
            if 'watts' in streams and streams['watts'] and i < len(streams['watts']):
                record.power = int(streams['watts'][i])
            
            builder.add(record)
    
    # Event message - stop
    event_stop = EventMessage()
    event_stop.timestamp = datetime.now()
    event_stop.event = 0  # timer
    event_stop.event_type = 3  # stop_all
    event_stop.event_group = 0
    builder.add(event_stop)
    
    # Build and return FIT file
    fit_file = builder.build()
    return fit_file.to_bytes()


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=2, max=30)
)
async def fetch_strava_activity_streams(client: Client, activity_id: int) -> dict:
    """Fetch activity streams from Strava with retry logic."""
    print(f"Fetching streams for activity {activity_id}...")
    
    streams = client.get_activity_streams(
        activity_id=activity_id,
        types=STREAM_TYPES,
        resolution='high'
    )
    
    return dict(streams)


def get_activities_since(client: Client, last_time: int, limit: int = 100):
    """Get all activities since a given timestamp."""
    activities = []
    
    while True:
        # Strava API uses 'after' parameter as epoch timestamp
        fetched_activities = client.get_activities(
            after=last_time,
            limit=limit
        )
        fetched_activities = list(fetched_activities)
        
        if not fetched_activities:
            break
            
        activities.extend(fetched_activities)
        
        if len(fetched_activities) < limit:
            break
    
    return activities


async def process_and_upload_activities(
    strava_client: Client,
    garmin_client: Garmin,
    activities: list,
    downloaded_ids: set,
    use_fake_garmin_device: bool = False
):
    """Process activities and upload to Garmin."""
    processed_count = 0
    skipped_count = 0
    
    for activity in activities:
        # Check if already processed (by checking local file existence)
        activity_id = str(activity.id)
        if activity_id in downloaded_ids:
            skipped_count += 1
            continue
        
        # Skip non-running activities if needed
        # if not activity.type == 'Run':
        #     continue
        
        try:
            # Get activity streams
            streams = await fetch_strava_activity_streams(strava_client, activity.id)
            
            if not streams or 'latlng' not in streams or not streams['latlng']:
                print(f"Activity {activity.id} has no GPS data, skipping...")
                continue
            
            # Get full activity details
            detailed = strava_client.get_activity(activity.id)
            
            # Prepare activity info
            activity_info = {
                'name': detailed.name or f"Activity {activity.id}",
                'start_date': detailed.start_date,
                'type': detailed.type or 'Run',
                'sport_type': getattr(detailed, 'sport_type', None)
            }
            
            # Convert to FIT
            print(f"Converting activity {activity.id} to FIT format...")
            fit_data = strava_to_fit_activity(
                activity_id=activity.id,
                streams=dict(streams),
                activity_info=activity_info
            )
            
            # Save to temporary file for upload
            temp_filename = f"strava_{activity.id}.fit"
            with open(temp_filename, 'wb') as f:
                f.write(fit_data)
            
            # Wrap with Garmin device info if it's a FIT file
            with open(temp_filename, 'rb') as f:
                if use_fake_garmin_device and is_fit_file(f):
                    wrapped_data = wrap_device_info(f)
                    with open(temp_filename, 'wb') as out:
                        out.write(wrapped_data.read())
            
            # Upload to Garmin
            print(f"Uploading activity {activity.id} to Garmin...")
            await garmin_client.upload_activity_from_file(temp_filename)
            
            # Clean up
            os.remove(temp_filename)
            
            processed_count += 1
            
        except Exception as e:
            print(f"Failed to process activity {activity.id}: {str(e)}")
            traceback.print_exc()
            continue
    
    return processed_count, skipped_count


def main():
    parser = argparse.ArgumentParser(
        description='Strava to Garmin sync using API streams (no JWT required)'
    )
    parser.add_argument('client_id', help='Strava client ID')
    parser.add_argument('client_secret', help='Strava client secret')
    parser.add_argument('refresh_token', help='Strava refresh token')
    parser.add_argument('garmin_secret', help='Garmin secret string')
    parser.add_argument(
        '--is-cn',
        dest='is_cn',
        action='store_true',
        help='Use Garmin China'
    )
    parser.add_argument(
        '--use-fake-garmin-device',
        dest='use_fake_garmin_device',
        action='store_true',
        help='Wrap FIT file with fake Garmin device info'
    )
    parser.add_argument(
        '--only-run',
        dest='only_run',
        action='store_true',
        help='Only sync running activities'
    )
    
    options = parser.parse_args()
    
    # Initialize Strava client
    print("Initializing Strava client...")
    strava_client = make_strava_client(
        options.client_id,
        options.client_secret,
        options.refresh_token
    )
    
    # Get last sync time
    last_time = get_strava_last_time(strava_client)
    print(f"Last sync time: {last_time}")
    
    if last_time == 0:
        # If no activities, go back 1 year
        import time
        last_time = int(time.time()) - 365 * 24 * 60 * 60
    
    # Get activities since last sync
    print("Fetching activities from Strava...")
    activities = get_activities_since(strava_client, last_time)
    print(f"Found {len(activities)} activities to sync")
    
    if not activities:
        print("No new activities to sync")
        return
    
    # Initialize Garmin client
    print("Initializing Garmin client...")
    garmin_client = Garmin(
        options.garmin_secret,
        'CN' if options.is_cn else None,
        options.only_run
    )
    
    # Get already downloaded activity IDs
    downloaded_ids = set()
    fit_folder = 'FIT_OUT'
    if os.path.exists(fit_folder):
        downloaded_ids = {f.split('.')[0] for f in os.listdir(fit_folder) if f.endswith('.fit')}
    
    # Process and upload
    print("Processing and uploading activities...")
    loop = asyncio.get_event_loop()
    processed, skipped = loop.run_until_complete(
        process_and_upload_activities(
            strava_client,
            garmin_client,
            activities,
            downloaded_ids,
            options.use_fake_garmin_device
        )
    )
    
    print(f"\nSync complete!")
    print(f"Processed: {processed}")
    print(f"Skipped: {skipped}")


if __name__ == '__main__':
    main()
