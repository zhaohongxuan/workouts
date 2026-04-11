import argparse
import asyncio
from datetime import datetime, timedelta
from io import BytesIO
from xml.etree import ElementTree

import gpxpy
import gpxpy.gpx
from garmin_sync import Garmin
from strava_sync import run_strava_sync
from stravaweblib import DataFormat, WebClient
from utils import make_strava_client, strava_streams_to_fit, STRAVA_STREAM_TYPES


def generate_strava_run_points(start_time, strava_streams):
    """
    strava return same len data list
    """
    if not (strava_streams.get("time") and strava_streams.get("latlng")):
        return None
    points_dict_list = []
    time_list = strava_streams["time"].data
    time_list = [start_time + timedelta(seconds=int(i)) for i in time_list]
    latlng_list = strava_streams["latlng"].data

    for i, j in zip(time_list, latlng_list):
        points_dict_list.append(
            {
                "latitude": j[0],
                "longitude": j[1],
                "time": i,
            }
        )
    # add heart rate
    if strava_streams.get("heartrate"):
        heartrate_list = strava_streams.get("heartrate").data
        for index, h in enumerate(heartrate_list):
            points_dict_list[index]["heart_rate"] = h
    # add altitude
    if strava_streams.get("altitude"):
        heartrate_list = strava_streams.get("altitude").data
        for index, h in enumerate(heartrate_list):
            points_dict_list[index]["elevation"] = h
    return points_dict_list


def make_gpx_from_points(title, points_dict_list):
    gpx = gpxpy.gpx.GPX()
    gpx.nsmap["gpxtpx"] = "http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
    gpx_track = gpxpy.gpx.GPXTrack()
    gpx_track.name = title
    gpx_track.type = "Run"
    gpx.tracks.append(gpx_track)

    # Create first segment in our GPX track:
    gpx_segment = gpxpy.gpx.GPXTrackSegment()
    gpx_track.segments.append(gpx_segment)
    for p in points_dict_list:
        if p.get("heart_rate") is None:
            point = gpxpy.gpx.GPXTrackPoint(**p)
        else:
            heart_rate_num = p.pop("heart_rate")
            point = gpxpy.gpx.GPXTrackPoint(**p)
            gpx_extension_hr = ElementTree.fromstring(
                f"""<gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
                <gpxtpx:hr>{heart_rate_num}</gpxtpx:hr>
                </gpxtpx:TrackPointExtension>
            """
            )
            point.extensions.append(gpx_extension_hr)
        gpx_segment.points.append(point)
    return gpx.to_xml()


class ExportFile:
    """Wrapper for activity data file to match stravaweblib's ExportFile interface."""
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content


async def upload_to_activities(
    garmin_client, strava_client, strava_web_client, format, use_fake_garmin_device
):
    last_activity = await garmin_client.get_activities(0, 1)
    if not last_activity:
        print("no garmin activity")
        filters = {}
    else:
        # is this startTimeGMT must have ?
        after_datetime_str = last_activity[0]["startTimeGMT"]
        after_datetime = datetime.strptime(after_datetime_str, "%Y-%m-%d %H:%M:%S")
        print("garmin last activity date: ", after_datetime)
        filters = {"after": after_datetime}
    strava_activities = list(strava_client.get_activities(**filters))
    files_list = []
    print("strava activities size: ", len(strava_activities))
    if not strava_activities:
        print("no strava activity")
        return files_list

    # strava rate limit
    for i in sorted(strava_activities, key=lambda i: int(i.id)):
        try:
            data = strava_web_client.get_activity_data(i.id, fmt=format)
            files_list.append(data)
        except Exception as ex:
            print("get strava data error: ", ex)
    await garmin_client.upload_activities_original_from_strava(
        files_list, use_fake_garmin_device
    )
    return files_list


async def upload_to_activities_via_streams(
    garmin_client, strava_client, use_fake_garmin_device
):
    """
    Alternative implementation using Strava API streams instead of stravaweblib.
    This method doesn't require JWT authentication and works in CI/CD environments.
    """
    try:
        from garmin_device_adaptor import wrap_device_info, is_fit_file
    except ImportError:
        def wrap_device_info(f):
            return BytesIO(f.read())
        def is_fit_file(f):
            return False
    
    last_activity = await garmin_client.get_activities(0, 1)
    if not last_activity:
        print("no garmin activity")
        filters = {}
    else:
        after_datetime_str = last_activity[0]["startTimeGMT"]
        after_datetime = datetime.strptime(after_datetime_str, "%Y-%m-%d %H:%M:%S")
        print("garmin last activity date: ", after_datetime)
        filters = {"after": after_datetime}
    
    strava_activities = list(strava_client.get_activities(**filters))
    print("strava activities size: ", len(strava_activities))
    if not strava_activities:
        print("no strava activity")
        return []
    
    files_list = []
    
    for activity in sorted(strava_activities, key=lambda i: int(i.id)):
        try:
            print(f"Processing activity {activity.id}...")
            
            # Get streams via API (no JWT required!)
            streams = strava_client.get_activity_streams(
                activity_id=activity.id,
                types=STRAVA_STREAM_TYPES,
                resolution='high'
            )
            
            if not streams or 'latlng' not in streams or not streams['latlng']:
                print(f"Activity {activity.id} has no GPS data, skipping...")
                continue
            
            # Get full activity details for metadata
            detailed = strava_client.get_activity(activity.id)
            
            activity_info = {
                'name': detailed.name or f"Activity {activity.id}",
                'start_date': detailed.start_date,
                'type': detailed.type or 'Run',
            }
            
            # Convert streams to FIT
            fit_data = strava_streams_to_fit(
                activity_id=activity.id,
                streams=dict(streams),
                activity_info=activity_info
            )
            
            # Create temp file
            temp_filename = f"strava_{activity.id}.fit"
            with open(temp_filename, 'wb') as f:
                f.write(fit_data)
            
            # Wrap with Garmin device info if needed
            if use_fake_garmin_device:
                with open(temp_filename, 'rb') as f:
                    if is_fit_file(f):
                        wrapped = wrap_device_info(f)
                        with open(temp_filename, 'wb') as out:
                            out.write(wrapped.read())
            
            # Create ExportFile-like object
            files_list.append(ExportFile(temp_filename, fit_data))
            
        except Exception as ex:
            print(f"get strava data error: ", ex)
            continue
    
    # Upload all files
    if files_list:
        await garmin_client.upload_activities_original_from_strava(
            files_list, use_fake_garmin_device
        )
    
    return files_list


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("strava_client_id", help="strava client id")
    parser.add_argument("strava_client_secret", help="strava client secret")
    parser.add_argument("strava_refresh_token", help="strava refresh token")
    parser.add_argument(
        "secret_string", nargs="?", help="secret_string fro get_garmin_secret.py"
    )
    parser.add_argument("strava_email", nargs="?", help="email of strava")
    parser.add_argument("strava_password", nargs="?", help="password of strava")
    parser.add_argument("strava_jwt", nargs="?", help="jwt token of strava")
    parser.add_argument(
        "--is-cn",
        dest="is_cn",
        action="store_true",
        help="if garmin account is cn",
    )
    parser.add_argument(
        "--use_fake_garmin_device",
        action="store_true",
        default=False,
        help="whether to use a faked Garmin device",
    )
    parser.add_argument(
        "--use-streams",
        dest="use_streams",
        action="store_true",
        default=False,
        help="use Strava API streams instead of JWT (no JWT required, works in CI)",
    )
    options = parser.parse_args()
    strava_client = make_strava_client(
        options.strava_client_id,
        options.strava_client_secret,
        options.strava_refresh_token,
    )
    
    garmin_auth_domain = "CN" if options.is_cn else ""

    try:
        garmin_client = Garmin(options.secret_string, garmin_auth_domain)
        loop = asyncio.get_event_loop()
        
        if options.use_streams:
            # Use new streams-based method (no JWT required!)
            print("Using Strava API streams method (no JWT required)...")
            future = asyncio.ensure_future(
                upload_to_activities_via_streams(
                    garmin_client,
                    strava_client,
                    options.use_fake_garmin_device,
                )
            )
        else:
            # Use traditional JWT-based method
            if options.strava_jwt:
                strava_web_client = WebClient(
                    access_token=strava_client.access_token,
                    jwt=options.strava_jwt,
                )
            elif options.strava_email and options.strava_password:
                strava_web_client = WebClient(
                    access_token=strava_client.access_token,
                    email=options.strava_email,
                    password=options.strava_password,
                )
            else:
                print("Error: JWT or email/password required for non-streams mode")
                sys.exit(1)
            
            print("Using traditional JWT method...")
            future = asyncio.ensure_future(
                upload_to_activities(
                    garmin_client,
                    strava_client,
                    strava_web_client,
                    DataFormat.ORIGINAL,
                    options.use_fake_garmin_device,
                )
            )
        
        loop.run_until_complete(future)
    except Exception as err:
        print(err)

    # Run the strava sync
    run_strava_sync(
        options.strava_client_id,
        options.strava_client_secret,
        options.strava_refresh_token,
    )
