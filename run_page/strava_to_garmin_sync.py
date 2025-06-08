import argparse
import asyncio
import requests
from datetime import datetime, time, timedelta
from xml.etree import ElementTree
import io

import time as time_module
import gpxpy
import gpxpy.gpx
from garmin_sync import Garmin
from strava_sync import run_strava_sync
from utils import make_strava_client


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


def export_strava_activity_to_fit(access_token, activity_id):
    """
    Download Strava activity data and return it in memory.
    Returns a file-like object with filename attribute if successful, None if failed.
    """
    try:
        download_url = (
            f"https://www.strava.com/activities/{activity_id}/export_original"
        )

        headers = {
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36",
        }
        print(f"Downloading activity {activity_id} from: {download_url}")
        response = requests.get(download_url, headers=headers, stream=True)

        if response.status_code == 200:
            file_obj = io.BytesIO()
            content = b''
            for chunk in response.iter_content(chunk_size=8192):
                content += chunk
            file_obj.write(content)
            file_obj.seek(0)  # 重置文件指针到开始位置
            file_obj.content = [content]  # 使用完整的文件内容
            file_obj.filename = f"activity_{activity_id}.fit"
            print(f"Successfully downloaded activity {activity_id}, file size: {file_obj.getbuffer().nbytes} bytes")
            return file_obj
        else:
            print(f"Download failed. HTTP status code: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error downloading activity {activity_id}: {e}")
        return None


async def upload_to_activities(garmin_client, strava_client, use_fake_garmin_device):
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
            # Use the new export_strava_activity_to_fit function instead of strava_web_client
            data = export_strava_activity_to_fit(strava_client.access_token, i.id)
            if data:
                files_list.append(data)
            # sleep 2 seconds to avoid Strava server rate limit
            time_module.sleep(2)

        except Exception as ex:
            print("get strava data error: ", ex)
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
        future = asyncio.ensure_future(
            upload_to_activities(
                garmin_client,
                strava_client,
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
