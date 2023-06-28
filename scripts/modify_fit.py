from fit_tool.fit_file import FitFile
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.device_info_message import DeviceInfoMessage
from fit_tool.profile.messages.file_id_message import FileIdMessage


def add_device_info_to_fit_file(origin_fit_file):
    """
    add customized device info to fit file,  the device manufacturer and product info
    can be found in github: https://github.com/garmin/fit-python-sdk/blob/main/garmin_fit_sdk/profile.py

    """
    fit_file = FitFile.from_bytes(origin_fit_file.read())
    builder = FitFileBuilder(auto_define=True)

    # Add custom Device Info
    message = DeviceInfoMessage()
    # the serial number must be real, otherwise Garmin will not identify it
    message.serial_number = 3445161330
    message.manufacturer = 1
    message.garmin_product = 4315
    message.software_version = 3.58
    message.device_index = 0
    message.source_type = 5
    message.product = 4315
    builder.add(message)

    for record in fit_file.records:
        message = record.message
        if message.global_id == FileIdMessage.ID:
            if isinstance(message, FileIdMessage):
                message.manufacturer = 1
                message.garmin_product = 4315
                message.product = 4315
                message.type = 4

        builder.add(message)

    modified_file = builder.build()
    # for local test
    # modified_file.to_csv("/Users/hank.zhao/Developer/workouts/test/modified_activity.csv")
    return modified_file.to_bytes()
