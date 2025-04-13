import json

from sino.scraper import get_points
from sino.tracks import clean

points = get_points()
tracks, df = clean(points)

paths = []
for trackID, d in df.groupby("trackID"):
    path = d[["dbLat", "dbLon"]].to_dict(orient="list")
    path = list(zip(path["dbLon"], path["dbLat"]))
    timestamps = list(d.nTime - d.nTime.min())
    start = int(d.nTime.min())
    vendor = 0

    paths.append(
        dict(
            vendor=vendor,
            path=path,
            timestamps=timestamps,
            start=start,
        )
    )


with open("./data.json", "w") as f:
    json.dump(paths, f)