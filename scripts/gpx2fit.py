from datetime import datetime

import gpxpy
import math
from geopy.distance import geodesic

from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.event_message import EventMessage
from fit_tool.profile.messages.device_info_message import DeviceInfoMessage

from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.record_message import RecordMessage
from fit_tool.profile.profile_type import FileType, Manufacturer, Event, EventType


def convert_gpx_to_fit(input_gpx_path, output_fit_path):
    """This example shows how to encode an activity into the FIT format and write it to a file. For simplicity, this
    example uses the FitFileBuilder to construct the FIT file, however in practice you might want to encode and
    write record messages to the file immediately for robustness and better memory usage. An example of how to do this
    is in the unit tests.
    """

    # Set auto_define to true, so that the builder creates the required Definition Messages for us.
    builder = FitFileBuilder(auto_define=True, min_string_size=50)

    # Read position data from a GPX file
    gpx_file = open(input_gpx_path, 'r')
    gpx = gpxpy.parse(gpx_file)

    message = FileIdMessage()
    message.type = FileType.ACTIVITY
    message.manufacturer = Manufacturer.GARMIN.value
    message.product = 0
    timestamp = datetime.timestamp(gpx.time)
    message.time_created = round(timestamp*1000)
    message.serial_number = 0x12345678
    builder.add(message)
    
    # Device Info TODO 
    message = DeviceInfoMessage()
    

    # It is a best practice to include timer start and stop events in all Activity files. A timer start event
    # should occur before the first Record message in the file, and a timer stop event should occur after the
    # last Record message in the file when the activity recording is complete. Timer stop and start events
    # should be used anytime the activity recording has been paused and resumed. Record messages should not be
    # encoded to the file when the timer is paused.
    start_timestamp = round(datetime.timestamp(gpx.time)*1000)
    message = EventMessage()
    message.event = Event.TIMER
    message.event_type = EventType.START
    message.timestamp = start_timestamp
    builder.add(message)

    distance = 0.0
    timestamp = start_timestamp

    records = []

    prev_coordinate = None

    for index, track_point in enumerate(gpx.tracks[0].segments[0].points):
        current_coordinate = (track_point.latitude, track_point.longitude)

        # calculate distance from previous coordinate and accumulate distance
        if prev_coordinate:
            delta = geodesic(prev_coordinate, current_coordinate).meters
        else:
            delta = 0.0
        distance += delta

        message = RecordMessage()
        message.position_lat = track_point.latitude
        message.position_long = track_point.longitude
        message.distance = distance
        # message.speed =
        # message.grade = 
        # message.cadence = 
        message.timestamp =  round(datetime.timestamp( track_point.time)*1000)
        # hr = track_point.extensions[0].text
        # if hr:  
        #     message.heart_rate = hr
        # message.power = round(20 * math.sin(2 * math.pi * index / 50) + 200)
        records.append(message)
        prev_coordinate = current_coordinate

    builder.add_all(records)

    message = EventMessage()
    message.event = Event.TIMER
    message.event_type = EventType.STOP
    message.timestamp = timestamp
    builder.add(message)

    # Finally build the FIT file object and write it to a file
    fit_file = builder.build()

    out_path = output_fit_path
    fit_file.to_file(out_path)
    csv_path = '/Users/xuan/output.csv'
    fit_file.to_csv(csv_path)


if __name__ == "__main__":
    # 使用示例
    gpx_file_path = '/Users/xuan/Evening_Run.gpx'
    fit_file_path = '/Users/xuan/output.fit'
    convert_gpx_to_fit(gpx_file_path, fit_file_path)
