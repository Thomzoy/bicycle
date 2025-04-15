from datetime import datetime
import pytz
import pandas as pd
from zoneinfo import ZoneInfo
import geopy.distance
import numpy as np
import elevatr as elv

target_timezone = pytz.timezone("Europe/Paris")


def get_elevations_values(lon_col, lat_col):
    bottom_left = (
        float(lon_col.min()),
        float(lat_col.min()),
    )

    top_right = (
        float(lon_col.max()),
        float(lat_col.max()),
    )

    # Define the bounding box of the area of interest (min_lon, min_lat, max_lon, max_lat)
    bbx = bottom_left + top_right
    # Set the level of precision (between 0 and 14)
    zoom = 12

    # Access the elevation data
    raster_raw = elv.get_elev_raster(locations=bbx, zoom=zoom, crs="EPSG:4326")
    raster = raster_raw.to_numpy()

    def get_elevation(lon, lat, raster):
        assert lon <= top_right[0] and lat <= top_right[1]
        assert lon >= bottom_left[0] and lat >= bottom_left[1]

        get_lat_idx = lambda lat: int(
            (lat - bottom_left[1]) / (top_right[1] - bottom_left[1]) * raster.shape[1]
        )
        get_lon_idx = lambda lon: int(
            (lon - bottom_left[0]) / (top_right[0] - bottom_left[0]) * raster.shape[0]
        )

        lon_idx = min(get_lon_idx(lon), raster.shape[0] - 1)
        lat_idx = min(get_lat_idx(lat), raster.shape[1] - 1)

        return raster[lon_idx, lat_idx]

    elevations = [get_elevation(lon, lat, raster) for lon, lat in zip(lon_col, lat_col)]
    return raster_raw, elevations


def clean(
    points,
    tracks_delta=10,  # Minutes to split between tracks
    min_max_speed_for_valid_tracks=5,  # If max speed is below, track is removed
    max_max_speed_for_valid_tracks=55,  # If max speed is above, track is removed (remove car)
    remove_start_end_points_speed=5,  # Starting and ending points below this speed are removed
    min_duration=3,  # Tracks shorter are dropped
    min_date=(2025, 2, 12),
    max_date=None,
    get_elevations=True,
):
    df = pd.concat(
        [
            pd.DataFrame(
                columns=data["m_arrField"],
                data=data["m_arrRecord"],
            )
            for data in points
        ]
    )
    df["nTime"] = df["nTime"].astype(int)
    df["dbLon"] = df["dbLon"].astype(float)
    df["dbLat"] = df["dbLat"].astype(float)
    df["date"] = (
        pd.to_datetime(df.nTime, unit="s")
        .dt.tz_localize("UTC")
        .dt.tz_convert(target_timezone)
    )
    df = df[1:]  # Remove false first point

    if min_date:
        year, month, day = min_date
        df = df[
            df.date
            >= datetime(
                year=year, month=month, day=day, tzinfo=ZoneInfo("Europe/Paris")
            )
        ]
    if max_date:
        year, month, day = min_date
        df = df[
            df.date
            <= datetime(
                year=year, month=month, day=day, tzinfo=ZoneInfo("Europe/Paris")
            )
        ]

    df["nSpeed"] = df.nSpeed.astype(int)
    df["date_prev"] = df.date.shift()
    df["delta"] = (df.date - df.date_prev).dt.seconds / 60
    df["delta_sup"] = (df.delta > tracks_delta).astype(int)
    df["trackID_tmp"] = df["delta_sup"].cumsum()
    df = df.reset_index(drop=True).reset_index()

    elevations = 0
    if get_elevations:
        raster_raw, elevations = get_elevations_values(df.dbLon, df.dbLat)
    df["elevation"] = elevations

    def clean_track(df_track, th):
        min_point, max_point = 0, len(df_track)
        for idx, speed in enumerate(df_track.nSpeed):
            if speed > th:
                min_point = idx
                break
        for idx, speed in enumerate(df_track.nSpeed[::-1]):
            if speed > th:
                max_point = idx
                break
        df_track = df_track.iloc[min_point : len(df_track) - max_point]

        if df_track.empty:
            return df_track

        initial_elevation = df_track.elevation.iloc[0]
        df_track["elevation_prev"] = df_track.elevation.shift()
        df_track.iloc[0, -1] = initial_elevation  # FillNaN
        df_track["elevation_diff"] = df_track.elevation - df_track.elevation_prev
        df_track["d_plus"] = np.where(
            df_track.elevation_diff > 0, df_track.elevation_diff, 0
        ).cumsum()

        df_track["dbLat_prev"] = df_track.dbLat.shift()
        df_track["dbLon_prev"] = df_track.dbLon.shift()
        df_track["dist"] = df_track.apply(distance, axis=1) / 1e3
        df_track["duration"] = (df_track.date - df_track.date_prev).dt.seconds / 60
        df_track["dist_total"] = df_track["dist"].cumsum()
        df_track["duration_total"] = df_track["duration"].cumsum()

        return df_track

    def get_tracks(df):
        tracks = df.groupby("trackID_tmp", as_index=False).agg(
            start_date=("date", "min"),
            end_date=("date", "max"),
            # mean_speed=("nSpeed", "mean"),
            max_speed=("nSpeed", "max"),
            dist_total=("dist_total", "max"),
            d_plus_total=("d_plus", "max"),
        )
        tracks["duration"] = (tracks.end_date - tracks.start_date).dt.seconds / 60
        tracks["mean_speed"] = tracks.dist_total / (tracks.duration / 60)
        tracks = tracks[
            (tracks.max_speed >= min_max_speed_for_valid_tracks)
            & (tracks.max_speed <= max_max_speed_for_valid_tracks)
            & (tracks.duration >= min_duration)
        ]
        tracks["formatted_start_date"] = tracks.start_date.dt.strftime("%Y-%m-%d,%H:%M")
        return tracks

    def distance(row):
        if np.isnan(row.dbLat_prev) or np.isnan(row.dbLon_prev):
            return 0.0
        return geopy.distance.geodesic(
            (row.dbLat, row.dbLon), (row.dbLat_prev, row.dbLon_prev)
        ).m

    cleaned_points = [
        clean_track(df_track, remove_start_end_points_speed)
        for _, df_track in df.groupby("trackID_tmp")
    ]

    df = pd.concat(cleaned_points)
    tracks = get_tracks(df)

    df = df.merge(tracks["trackID_tmp"], on="trackID_tmp")

    tracks = tracks.reset_index().rename(columns=dict(index="trackID"))
    df = df.merge(tracks[["trackID", "trackID_tmp"]], on="trackID_tmp").drop(
        "trackID_tmp", axis=1
    )
    del tracks["trackID_tmp"]

    return tracks, df
