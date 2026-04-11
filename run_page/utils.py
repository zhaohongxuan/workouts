import json
import time
from datetime import datetime

import pytz

try:
    from rich import print
except:
    pass
from generator import Generator
from stravalib.client import Client
from stravalib.exc import RateLimitExceeded


def adjust_time(time, tz_name):
    tc_offset = datetime.now(pytz.timezone(tz_name)).utcoffset()
    return time + tc_offset


def adjust_time_to_utc(time, tz_name):
    tc_offset = datetime.now(pytz.timezone(tz_name)).utcoffset()
    return time - tc_offset


def adjust_timestamp_to_utc(timestamp, tz_name):
    tc_offset = datetime.now(pytz.timezone(tz_name)).utcoffset()
    delta = int(tc_offset.total_seconds())
    return int(timestamp) - delta


def to_date(ts):
    # TODO use https://docs.python.org/3/library/datetime.html#datetime.datetime.fromisoformat
    # once we decide to move on to python v3.7+
    ts_fmts = ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"]

    for ts_fmt in ts_fmts:
        try:
            # performance with using exceptions
            # shouldn't be an issue since it's an offline cmdline tool
            return datetime.strptime(ts, ts_fmt)
        except ValueError:
            print(
                f"Warning: Can not execute strptime {ts} with ts_fmt {ts_fmt}, try next one..."
            )
            pass

    raise ValueError(f"cannot parse timestamp {ts} into date with fmts: {ts_fmts}")


def make_activities_file(
    sql_file, data_dir, json_file, file_suffix="gpx", activity_title_dict={}
):
    generator = Generator(sql_file)
    generator.sync_from_data_dir(
        data_dir, file_suffix=file_suffix, activity_title_dict=activity_title_dict
    )
    activities_list = generator.load()
    with open(json_file, "w") as f:
        json.dump(activities_list, f, indent=0)


def make_activities_file_only(
    sql_file, data_dir, json_file, file_suffix="gpx", activity_title_dict={}
):
    generator = Generator(sql_file)
    generator.sync_from_data_dir(
        data_dir, file_suffix=file_suffix, activity_title_dict=activity_title_dict
    )
    activities_list = generator.loadForMapping()
    with open(json_file, "w") as f:
        json.dump(activities_list, f, indent=0)


def make_strava_client(client_id, client_secret, refresh_token):
    client = Client()

    refresh_response = client.refresh_access_token(
        client_id=client_id, client_secret=client_secret, refresh_token=refresh_token
    )
    client.access_token = refresh_response["access_token"]
    return client


def get_strava_last_time(client, is_milliseconds=True):
    """
    if there is no activities cause exception return 0
    """
    try:
        activity = None
        activities = client.get_activities(limit=10)
        activities = list(activities)
        activities.sort(key=lambda x: x.start_date, reverse=True)
        # for else in python if you don't know please google it.
        for a in activities:
            if a.type == "Run":
                activity = a
                break
        else:
            return 0
        end_date = activity.start_date + activity.elapsed_time
        last_time = int(datetime.timestamp(end_date))
        if is_milliseconds:
            last_time = last_time * 1000
        return last_time
    except Exception as e:
        print(f"Something wrong to get last time err: {str(e)}")
        return 0


def upload_file_to_strava(client, file_name, data_type, force_to_run=True):
    with open(file_name, "rb") as f:
        try:
            if force_to_run:
                r = client.upload_activity(
                    activity_file=f, data_type=data_type, activity_type="run"
                )
            else:
                r = client.upload_activity(activity_file=f, data_type=data_type)

        except RateLimitExceeded as e:
            timeout = e.timeout
            print()
            print(f"Strava API Rate Limit Exceeded. Retry after {timeout} seconds")
            print()
            time.sleep(timeout)
            if force_to_run:
                r = client.upload_activity(
                    activity_file=f, data_type=data_type, activity_type="run"
                )
            else:
                r = client.upload_activity(activity_file=f, data_type=data_type)
        print(
            f"Uploading {data_type} file: {file_name} to strava, upload_id: {r.upload_id}."
        )


# Stream types for strava API
STRAVA_STREAM_TYPES = [
    'time', 'latlng', 'altitude', 'heartrate', 'cadence',
    'watts', 'distance', 'speed', 'moving', 'grade_smooth'
]


def strava_streams_to_fit(activity_id: int, streams: dict, activity_info: dict) -> bytes:
    """
    Convert Strava activity streams to FIT format.
    
    This function uses fit_tool to build a proper FIT file from Strava API streams,
    eliminating the need for stravaweblib's JWT authentication.
    
    Args:
        activity_id: Strava activity ID
        streams: Dict of stream data from stravalib.get_activity_streams()
        activity_info: Dict with activity metadata (name, start_date, type, etc.)
    
    Returns:
        bytes: FIT file content
    """
    try:
        from fit_tool.fit_file_builder import FitFileBuilder
        from fit_tool.profile.messages.file_id_message import FileIdMessage
        from fit_tool.profile.messages.file_creator_message import FileCreatorMessage
        from fit_tool.profile.messages.activity_message import ActivityMessage
        from fit_tool.profile.messages.session_message import SessionMessage
        from fit_tool.profile.messages.lap_message import LapMessage
        from fit_tool.profile.messages.record_message import RecordMessage
        from fit_tool.profile.messages.event_message import EventMessage
        from fit_tool.profile.messages.device_info_message import DeviceInfoMessage
    except ImportError:
        raise ImportError(
            "fit_tool library is required for streams-to-FIT conversion. "
            "Install with: pip install fit-tool garmin-fit-sdk"
        )
    
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
    activity_msg = ActivityMessage()
    activity_msg.timestamp = datetime.now()
    activity_msg.total_timer_time = streams.get('time', [0])[-1] if 'time' in streams else 0
    activity_msg.num_sessions = 1
    activity_msg.type = 0  # manual
    activity_msg.event = 0  # activity
    activity_msg.event_type = 2  # stop
    builder.add(activity_msg)
    
    # Session message
    session = SessionMessage()
    session.timestamp = datetime.now()
    session.event = 7  # session
    session.event_type = 2  # stop
    session.start_time = activity_info.get('start_date', datetime.now())
    session.sport = 1  # generic
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
        
        # Handle both list and EnchancedIterator types from stravalib
        if hasattr(times, 'data'):
            times = times.data
        if hasattr(streams.get('latlng'), 'data'):
            streams['latlng'].data = streams['latlng'].data
        
        first_ts = times[0]
        
        # Get optional stream data (handle EnhancedIterator types)
        altitude_data = streams.get('altitude')
        if hasattr(altitude_data, 'data'):
            altitude_data = altitude_data.data
            
        heartrate_data = streams.get('heartrate')
        if hasattr(heartrate_data, 'data'):
            heartrate_data = heartrate_data.data
            
        cadence_data = streams.get('cadence')
        if hasattr(cadence_data, 'data'):
            cadence_data = cadence_data.data
            
        distance_data = streams.get('distance')
        if hasattr(distance_data, 'data'):
            distance_data = distance_data.data
            
        speed_data = streams.get('speed')
        if hasattr(speed_data, 'data'):
            speed_data = speed_data.data
            
        watts_data = streams.get('watts')
        if hasattr(watts_data, 'data'):
            watts_data = watts_data.data
            
        latlng_data = streams.get('latlng')
        if hasattr(latlng_data, 'data'):
            latlng_data = latlng_data.data
        
        for i in range(len(times)):
            record = RecordMessage()
            
            # Timestamp (relative to activity start)
            record.timestamp = int(first_ts + times[i])
            
            # GPS coordinates
            if latlng_data and i < len(latlng_data):
                lat, lon = latlng_data[i]
                # Convert to semicircles (FIT format)
                record.position_lat = lat * (2**31 / 180)
                record.position_long = lon * (2**31 / 180)
            
            # Altitude
            if altitude_data and i < len(altitude_data):
                record.altitude = altitude_data[i]
            
            # Heart rate
            if heartrate_data and i < len(heartrate_data):
                record.heart_rate = int(heartrate_data[i])
            
            # Cadence
            if cadence_data and i < len(cadence_data):
                record.cadence = int(cadence_data[i])
            
            # Distance
            if distance_data and i < len(distance_data):
                record.distance = distance_data[i]
            
            # Speed (m/s)
            if speed_data and i < len(speed_data):
                record.speed = speed_data[i]
            
            # Power (watts)
            if watts_data and i < len(watts_data) and watts_data[i] is not None:
                record.power = int(watts_data[i])
            
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
