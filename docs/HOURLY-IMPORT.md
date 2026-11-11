# Optional hourly energy import

CSV processing stays local and requires no external API. The source is always user-supplied and unverified. This improves the available time-resolution input; it does not automatically prove the results are more accurate.

## Format

```csv
timestamp,production_kwh_per_kwp,load_kwh
2024-12-31T17:00:00Z,0,0.42
2024-12-31T18:00:00Z,0,0.38
```

This example starts at midnight WIB on 1 January 2025. Complete the full local year: 8,760 rows or 8,784 in a leap year. `timestamp` must be the first column. One or both energy columns may be present; omit an unused column completely, not its values. The empty template is deliberately rejected until filled with valid data.

- Timestamp denotes the beginning of a 60-minute interval. Explicit `Z` or UTC offset is required. Equivalent offsets are accepted only when they represent the expected instant. Rows must be chronological with no gaps, repeats, partial years, or rollover substitutions.
- `production_kwh_per_kwp` is AC energy during that hour, divided by installed DC kWp. It is after the source's system losses. It is not GHI, DC energy, or instantaneous watts.
- `load_kwh` is whole-building energy demand during that hour. Grid import/net meter data cannot stand in for total load where PV/batteries already operate.
- Comma delimiter, dot decimals, no thousands separators, quoted cells, extra columns, negative values, missing cells, or nonfinite values. UTF-8 BOM and standard line endings are accepted. Maximum 4 MiB.
- Source name/reference and period are mandatory. The main model year/timezone must match the file. Data spanning a UTC year but not the selected local year must be prepared with the required boundary hours; the importer does not invent them.

The app derives monthly totals from imported values and locks those displayed totals. Changing the calendar or other incompatible assumptions produces a validation error, not silent resampling. Remove or reimport the series to change these. Imported hourly load replaces schedule assumptions; imported hourly production replaces monthly-profile timing.

## Prevent double correction

Hourly AC production cannot be combined with the geographic transposition because roof orientation and source losses should already be reflected in AC output. A load-only file can be combined with geography. The engine still enforces the selected inverter's hourly-average AC cap on scaled AC production. If the source has already clipped, this cannot recover energy removed by the source inverter or accurately reconstruct a different inverter design.

## Preparing external model output

For an **hourly average** power output in W, interval energy is `W × 1 hour / 1000`. Then divide system AC energy by DC kWp. Do not treat an instantaneous power sample as a one-hour average without a justified integration method. Validate source timezone, timestamps, normalization, loss accounting, and year before conversion. PVGIS has documented timestamp/data semantics that differ across radiation products; raw provider JSON/CSV is intentionally not guessed by this importer.

Primary references:
- JRC hourly output and units: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-tools/hourly-radiation_en
- JRC API documentation: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en

No JRC API is invoked by this application, and importing a file does not confer a JRC or other verification badge.
