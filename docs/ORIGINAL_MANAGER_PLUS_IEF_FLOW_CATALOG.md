# Original eKuiper Manager 1.9.5-plus-IEF Flow Catalog

Status: static artifact verified
Source artifact: user-supplied teardown of `emqx/ekuiper-manager:1.9.5-plus-ief`
Image creation time: 2024-04-18
Purpose: preserve every vendor-specific Flow node and property without confusing it with the live stock 1.8.0 audit.

## Evidence and scope

This catalog is extracted from the image's own:

- `web/common/flow/Properties.json`;
- `web/common/flow/PropertiesRest.json`;
- `web/common/flow/streamFields.json`;
- shipped frontend source maps.

It is not a recommendation to reproduce Huawei IEF, railway/industrial hardware integrations, or proprietary processing functions. It is evidence of how the original Manager extended a generic graph editor with declarative node metadata.

Evidence labels:

- `trial` and `installed` are copied from the shipped node metadata.
- A blank value means the artifact did not declare that flag or default.
- `required` means metadata `optional: false`.
- `optional` means metadata `optional: true`.

## Complete category and node inventory

| Category | Node keys |
| --- | --- |
| edge | `crczmq`, `source_mqtt` |
| source | `CSV`, `TXT`, `neuron` |
| function | `savitzky_golay`, `cleannormal`, `dimensionreduction`, `cleandrop`, `cleansort`, `peakvally`, `listmax`, `listrms`, `listamp`, `butterworth`, `chebyshev`, `fftTrans`, `fftPSD`, `vibration_acceleration`, `analog_input_single`, `analog_input_diff`, `digital_input`, `wireless_vibration_sensor`, `wireless_strain_sensor` |
| sink | `mqttpv`, `file`, `tdengine` |
| chart | `line` |

`PropertiesRest.json` supplies a runtime/injection subset containing sources `crczmq`, `CSV`, `TXT`; functions `vibration_acceleration`, `analog_input_single`, `analog_input_diff`, `digital_input`, `wireless_vibration_sensor`, `wireless_strain_sensor`; and chart `line`.

## Edge nodes

### `crczmq` — ZMQ

- Node type: `crrc_zmq`.
- Trial: Yes.
- Installed: No.
- Required `server`: text/string, label `Server address`.
- Output port: `signal`, label `Output`.
- Declared dependency: `github.com/pebbe/zmq4@v1.0.0`.
- Description explicitly says the demo ZeroMQ sink is not for production use.

### `source_mqtt` — MQTT

- Node type: `mqtt`.
- Trial: No.
- Installed: Yes.
- Output port: `signal`, label `Output`.

| Property key | Label | Control/type | Requirement | Choices |
| --- | --- | --- | --- | --- |
| `server` | MQTT broker address | text/string | Required | — |
| `topic` | MQTT topic | text/string | Required | — |
| `clientId` | MQTT ClientID | text/string | Optional | — |
| `protocolVersion` | MQTT protocol version | select/string | Optional | `3.1`, `3.1.1` |
| `qos` | QoS | select/list-int | Optional | `0`, `1`, `2` |
| `username` | Username | text/string | Optional | — |
| `password` | Password | text/string | Optional | — |
| `certificationPath` | Certification path | text/string | Optional | — |
| `privateKeyPath` | Private key path | text/string | Optional | — |
| `rootCaPath` | Root Ca path | text/string | Optional | — |
| `insecureSkipVerify` | Skip Certification verification | radio/bool | Optional | True, False |

Password is declared as an ordinary text control rather than a masked secret control.

## Source nodes

### `CSV`

- Label: CSV.
- Node type: `crrc_file`.
- Trial: Yes.
- Installed: No.
- Required `file`: file/string control, label `file selection`.
- Output port: `signal`.

### `TXT`

- Label: TXT.
- Node type: `crrc_file`.
- Trial: Yes.
- Installed: No.
- Output port: `signal`.

| Property key | Label | Control/type | Requirement |
| --- | --- | --- | --- |
| `file` | file selection | file/string | Required |
| `interval` | Interval(s) | text/int | Required |
| `length` | Data Length | text/int | Required |

### `neuron`

- Label: Neuron.
- Trial: Yes.
- Installed: No.
- Node type is literally the unfinished marker `TODO:`.
- No properties are declared.

## Processing function nodes without property forms

The following nodes declare no properties. Each is non-trial in the artifact; an installed flag is not declared.

| Key | English label | Node type |
| --- | --- | --- |
| `savitzky_golay` | Polynomial Fitting Smoothing | `function` |
| `cleannormal` | normalization function | `function` |
| `dimensionreduction` | Data dimensionality reduction processing | `function` |
| `cleandrop` | Data downsampling | `function` |
| `cleansort` | Sort function | `function` |
| `peakvally` | Peak and valley detection | `function` |
| `listmax` | Maximum value statistics | `function` |
| `listrms` | Root mean square statistics | `function` |
| `listamp` | Spoke value statistics | `function` |
| `butterworth` | butterworth filter | `function` |
| `chebyshev` | chebyshev filter | `function` |
| `fftTrans` | Spectrum analysis (magnitude spectrum) | `function` |
| `fftPSD` | Spectrum analysis (power spectrum) | `function` |

## Hardware/data-acquisition function nodes

These nodes use `nodeType: filter` and expose `address` and `channel` as column-selector arrays. Their `hatID` is hidden in the declarative metadata and supplies the stated default.

| Key / label | Hidden `hatID` | Address choices | Channel choices | Output |
| --- | ---: | --- | --- | --- |
| `vibration_acceleration` / Vibration acceleration | 325 | 0–7 | 0, 1 | `signal` |
| `analog_input_single` / Analog input (Single-ended) | 322 | 0–7 | 0–7 | `signal` |
| `analog_input_diff` / Analog input (Differential signal) | 326 | 0–7 | 0–3 | `signal` |
| `digital_input` / Digital input | 324 | 0–7 | 0–3 | `signal` |
| `wireless_vibration_sensor` / Wireless vibration sensor | 520 | 0–7 | 0–2 | `signal` |
| `wireless_strain_sensor` / Wireless strain sensor | 521 | 0–7 | 0–2 | `signal` |

For every row:

- `hatID` is required integer text with its declared default;
- `address` is an optional array using `col_selector`;
- `channel` is an optional array using `col_selector`.

## Sink nodes

### `mqttpv` — MQTT

- Node type: `mqtt`.
- Trial: No.
- Installed: Yes.

| Property key | Label | Control/type | Requirement | Default |
| --- | --- | --- | --- | --- |
| `server` | MQTT broker address | text/string | Required | blank |
| `topic` | MQTT topic | text/string | Required | blank |
| `sendSingle` | Send single | radio/bool | Required | `true` |

### `file` — File

- Node type is literally `TODO:`.
- Trial: Yes.
- Installed: Yes.

| Property key | Label | Control/type | Requirement |
| --- | --- | --- | --- |
| `fileType` | File type | text/string | Optional |
| `path` | Path | text/string | Required |
| `interval` | Interval | text/int | Required |

### `tdengine` — TDengine

- Node type is literally `TODO:`.
- Trial: Yes.
- Installed: No.

| Property key | Label | Control/type | Requirement |
| --- | --- | --- | --- |
| `ip` | Database address | text/string | Required |
| `port` | Port | text/int | Required |
| `user` | Username | text/string | Required |
| `password` | Password | text/string | Required |
| `database` | Database name | text/string | Required |
| `table` | Table name | text/string | Required |
| `fields` | Table field | list/list-string | Required |
| `provideTs` | Whether to provide a timestamp | radio/bool | Required |
| `tsFieldName` | Timestamp field name | text/string | Required |

The password field is again ordinary text metadata, and `tsFieldName` is not declared conditional on `provideTs`.

## Chart node

### `line` — Line

- Node type: `nop`.
- Trial: Yes.
- Installed: Yes.
- No properties.
- Input ports are `x` labelled X-Axis and `y` labelled Y-Axis.

## Shipped stream-field example

The Flow bundle includes a fixed example schema:

- `id`: bigint;
- `name`: string;
- `age`: bigint;
- `hobbies`: struct;
  - `indoor`: array of string;
  - `outdoor`: array of string.

It is sample data, not a discovered engine schema.

## Adaptation conclusions

The reusable idea is the declarative extension contract:

- category;
- stable node key and engine node type;
- localized label, description, and help URL;
- author, trial, and installed metadata;
- library/dependency declarations;
- property schema with defaults, control type, choices, hints, optionality, and connection relationship;
- typed input/output ports.

Do not copy the artifact's unfinished or unsafe details. A target contract must additionally support:

- secret/password controls and redaction;
- conditional fields;
- semantic version and engine compatibility ranges;
- package checksum/signature and platform;
- explicit production-readiness state rather than a single trial boolean;
- schema validation for defaults and dropdown value types;
- accessible localized labels with a guaranteed English fallback;
- migration/versioning for saved graphs;
- no `TODO:` node types;
- separation between stock engine metadata and vendor-specific overlays.
