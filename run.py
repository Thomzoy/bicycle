import json

import pandas as pd
pd.options.mode.chained_assignment = None

from sino.scraper import get_points
from sino.tracks import clean

points = get_points()
tracks, df = clean(points)

paths = []
for trackID, d in df.groupby("trackID"):
    track = tracks[tracks.trackID == trackID].squeeze()
    values = d[["dbLat", "dbLon", "dist_total", "nSpeed", "duration_total"]].to_dict(orient="list")
    path = list(zip(values["dbLon"], values["dbLat"]))
    timestamps = list(d.nTime - d.nTime.min())
    start = int(d.nTime.min())

    paths.append(
        dict(
            path=path,
            timestamps=timestamps,
            speeds=values["nSpeed"],
            distances=values["dist_total"],
            start=start,
            duration_minutes=values["duration_total"],
            trackID=trackID,
            max_speed=float(track.max_speed),
            formatted_start_date=track.formatted_start_date,
            elevations=values["elevation"],
            d_plus=values["d_plus"],
        )
    )


with open("./data.json", "w") as f:
    json.dump(paths, f)