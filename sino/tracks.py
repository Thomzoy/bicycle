from datetime import datetime
import pytz
import pandas as pd
from zoneinfo import ZoneInfo
import geopy.distance
import numpy as np

target_timezone = pytz.timezone("Europe/Paris")

def clean(
    points,
    tracks_delta=10,  # Minutes to split between tracks
    min_max_speed_for_valid_tracks=5,  # If max speed is below, track is removed
    max_max_speed_for_valid_tracks=55,  # If max speed is above, track is removed (remove car)
    remove_start_end_points_speed=5,  # Starting and ending points below this speed are removed
    min_duration=3,  # Tracks shorter are dropped
    min_date=(2025, 2, 12),
    max_date=None,
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

    def get_tracks(df):
        tracks = df.groupby("trackID_tmp", as_index=False).agg(
            start_date=("date", "min"),
            end_date=("date", "max"),
            #mean_speed=("nSpeed", "mean"),
            max_speed=("nSpeed", "max"),
            dist_total=("dist_total", "max"),
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
        df_track["dbLat_prev"] = df_track.dbLat.shift()
        df_track["dbLon_prev"] = df_track.dbLon.shift()
        df_track["dist"] = df_track.apply(distance, axis=1) / 1e3
        df_track["duration"] = (df_track.date - df_track.date_prev).dt.seconds / 60
        df_track["dist_total"] = df_track["dist"].cumsum()
        df_track["duration_total"] = df_track["duration"].cumsum()
        
        return df_track

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
