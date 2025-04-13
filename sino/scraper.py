import base64
import os
import random
import hashlib
import time
import requests
from datetime import datetime
import pytz
import tqdm

target_timezone = pytz.timezone("Europe/Paris")

strUser = os.environ["SINO_USER"]

strServerURL = "https://246.SinoTrack.com"
strContent = "\u0018"
strParamField = "\u0010"
strParamValue = "\u001f"
strServerFeild = "\b"
strServerRow = "\u0011"
strServerTable = "\u001b"


def encode(
    serverURL=strServerURL,
    Cmd="Proc_GetTrack",
    Data="N'7026108732',N'1739574000',N'1739660399',N'100000'",  # ID, TimeStart, TimeEnd, NPoints
    Field="",
    Server="",
    AbsolutePage=1,
    PageSize=200,
):
    serverURL = serverURL.replace("http://", "").replace("https://", "").lower()
    serverURL += (3 - len(serverURL) % 3) * "/"  # Pad with "/" until divisible by 3
    strAppID = base64.b64encode(serverURL.encode()).decode("utf-8")

    r = "".join(
        [
            Cmd,
            strServerRow,
            Data,
            strServerRow,
            Field,
            strServerRow,
            str(PageSize),
            strServerRow,
            str(AbsolutePage),
            strServerRow,
            strServerTable,
        ]
    )
    r += (3 - len(r) % 3) * "6"
    strToken = base64.b64encode(r.encode()).decode("utf-8")
    strRandom = str(round(random.random() * 1e14))

    h = hashlib.new("md5")
    nTimeStamp = int(time.time())
    i = str(nTimeStamp) + strRandom + strUser + strAppID + strToken
    h.update(i.encode())
    strSign = h.hexdigest()

    return {
        "strAppID": strAppID,
        "strUser": strUser,
        "nTimeStamp": nTimeStamp,
        "strRandom": strRandom,
        "strSign": strSign,
        "strToken": strToken,
    }


def _get_points(
    start_date: str = "16022025",
    end_date: str = None,
    format: str = "%d%m%Y",
    AbsolutePage: int = 2,
    PageSize: int = 200,
):
    start = datetime.timestamp(datetime.strptime(start_date, format))
    end = (
        datetime.timestamp(datetime.now())
        if end_date is None
        else datetime.timestamp(datetime.strptime(end_date, format))
    )
    data_str = f"N'{strUser}',N'{int(start)}',N'{int(end)}',N'100000'"

    data = encode(
        Cmd="Proc_GetTrack",
        Data=data_str,
        Field="",
        Server="",
        AbsolutePage=AbsolutePage,
        PageSize=PageSize,
    )

    headers = {
        "accept": "text/plain, */*; q=0.01",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "origin": "https://www.sinotrack.com",
        "priority": "u=1, i",
        "referer": "https://www.sinotrack.com/",
        "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Linux"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    }

    response = requests.post(
        "https://246.sinotrack.com/APP/AppJson.asp", headers=headers, data=data
    )
    return response.json()


def get_points(
    start_date: str = "16022025",
    end_date: str = None,
    format: str = "%d%m%Y",
):
    n_results = 0
    n_total = None
    done = False
    page = 1
    results = []

    while not done:
        points = _get_points(start_date, end_date, format, AbsolutePage=page)
        assert points["m_isResultOk"] == 1
        n_total = points["m_nTotal"]
        n_results += points["m_nCount"]
        print(f"Page {page}: {n_results} / {n_total}")
        done = n_results >= n_total
        results.append(points)
        page += 1
    return results
