# Ground Station Interface (GSI) Control Commands Definition

The tables below define the GSControl commands required for a serial device to interface with the Ground Station. Commands sent to the serial device can be manually sent by typing SD-(Command Name) in the GS command console. For an example implementation, see ```docs/examples/serial_v2_base```. Other commands may be defined by the user as needed. 

| Name       | Args              | Description                                                                            | GS version |
| :--------: | ----------------- | -------------------------------------------------------------------------------------- | :--------: |
| RESET      | None              | Hard reset of the device.                                                              | v2.1.0     |
| HANDSHAKE  | Response sequence | Initiate handshake sequence, send response sequence back to GS to complete handshake. This command invalidates a previous handshake success.  | v2.1.0     |
| HS_DONE    | SUCCESS/FAIL      | Whether the preceeding handshake was successful, invalid otherwise. All following commands should be invalid until this is true. | v2.1.0     |
| SET_MODE   | Mode              | Change the device mode, default valid modes are: SLEEP, NORMAL, HITL.                  | v2.1.0     |

**Table 1: Ground Station to Serial Device**


| Name       | Args              | Description                                                                            | GS version |
| :--------: | ----------------- | -------------------------------------------------------------------------------------- | :--------: |
| LOG        | Message           | Use for sending logs to the Ground Station at log levels: debug, warn, error.          | v2.1.0     |
| FATAL      | Message           | Use to send a log and indicate a fatal error that prevents the device from functioning.| v2.1.0     |

**Table 2: Serial Device to Ground Station**
